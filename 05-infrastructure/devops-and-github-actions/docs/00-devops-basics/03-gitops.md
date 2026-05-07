# GitOps

> An operational model that uses Git repositories as the Single Source of Truth, automatically synchronizing the declarative state of infrastructure and applications via a pull-based approach

## What You Will Learn

1. Understand the four principles of GitOps and the difference between push-based and pull-based deployments
2. Learn how ArgoCD and Flux work and how to configure them
3. Understand the relationship between immutable infrastructure and GitOps
4. Practice secret management and multi-cluster operations in GitOps
5. Understand GitOps troubleshooting and operational best practices


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Infrastructure as Code (IaC)](./02-infrastructure-as-code.md)

---

## 1. What Is GitOps

### 1.1 The Four Principles of GitOps

```
GitOps 4 Principles (OpenGitOps):

1. Declarative
   Declare the desired state of the system in code
   Example: Kubernetes manifests, Helm charts, Kustomize

2. Versioned and Immutable
   Manage desired state in Git and retain change history
   Example: All changes are recorded as Git commits

3. Pulled Automatically
   Approved changes are automatically applied to the system
   Example: ArgoCD/Flux detects Git changes and deploys automatically

4. Continuously Reconciled
   Detect drift between actual and desired state and auto-repair
   Example: Manual changes (kubectl) are automatically reverted
```

### 1.2 History and Background of GitOps

GitOps is a concept proposed in 2017 by Alexis Richardson of Weaveworks. By combining Kubernetes' declarative API with Git's immutable change history, it achieves a highly reliable deployment flow.

```
Evolution of GitOps:

2014  Kubernetes introduced → Foundation for declarative infrastructure management
2015  Helm introduced → Standardization of package management
2017  Weaveworks proposes "GitOps"
2018  Flux v1 released (first GitOps tool)
2019  Argo CD v1.0 released
2020  Flux/ArgoCD join CNCF as Sandbox projects
2021  Flux v2 released (complete rearchitecture)
2022  OpenGitOps project founded (standardization of principles)
2023  Argo CD becomes CNCF Graduated project
2024  Flux becomes CNCF Graduated project
```

### 1.3 Push-Based vs Pull-Based Deployments

```
Push-Based (Traditional CI/CD):
  ┌─────┐     ┌──────┐     ┌───────────┐
  │ Git │ ──→ │ CI/CD │ ──→ │ Kubernetes │
  │     │     │Server│     │ Cluster    │
  └─────┘     └──────┘     └───────────┘
                  │
           CI deploys
           directly to cluster
           (push)

  Problems:
  - CI requires credentials for the production environment
  - CI server is a SPOF (Single Point of Failure)
  - Cannot detect drift (divergence from actual state)
  - CI configuration tends to become complex
  - Audit trail depends on CI logs

Pull-Based (GitOps):
  ┌─────┐                  ┌───────────┐
  │ Git │ ←── monitors ←── │ Agent     │
  │     │                  │ (ArgoCD)  │
  └─────┘                  │ in Cluster│
                           └───────────┘
                                │
                          Detects drift and
                          applies automatically (pull)

  Benefits:
  - Credentials are not exposed outside the cluster
  - Agent continuously monitors and repairs drift
  - Git history = deployment history
  - Clear separation of CI and deployment responsibilities
  - Audit trail remains in Git commits
```

### 1.4 GitOps vs Traditional CI/CD

| Item | Traditional CI/CD | GitOps |
|---|---|---|
| Deployment method | Push-based | Pull-based |
| Source of truth | CI server | Git repository |
| Drift detection | None | Continuous reconciliation |
| Rollback | Re-deploy | Git revert |
| Credentials | Stored in CI | Confined within cluster |
| Audit trail | CI logs | Git commit history |
| Reproducibility | Depends on CI configuration | Fully reproducible from Git state |
| Disaster recovery | Depends on runbooks | Auto-restored from Git |

---

## 2. ArgoCD

### 2.1 How ArgoCD Works

```
┌──────────────────────────────────────────────┐
│              Kubernetes Cluster               │
│                                               │
│  ┌─────────────┐     ┌──────────────────┐    │
│  │  ArgoCD     │     │  Application     │    │
│  │  Controller │ ──→ │  Resources       │    │
│  │             │     │  (Deployment,    │    │
│  │  ・Git watch │     │   Service, etc.) │    │
│  │  ・Drift detect│   └──────────────────┘    │
│  │  ・Auto sync │                             │
│  └──────┬──────┘                              │
│         │ pull (every 3 minutes)              │
└─────────┼────────────────────────────────────┘
          │
          ↓
  ┌───────────────┐
  │ Git Repository │
  │ (manifests)    │
  │                │
  │ ├── base/      │
  │ ├── overlays/  │
  │ └── apps/      │
  └───────────────┘
```

### 2.2 Installing and Setting Up ArgoCD

```bash
# Install ArgoCD (requires a Kubernetes cluster)
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Install ArgoCD CLI
brew install argocd  # macOS
# or
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd && sudo mv argocd /usr/local/bin/

# Get initial password
argocd admin initial-password -n argocd

# Login
argocd login localhost:8080

# Change password
argocd account update-password
```

```yaml
# Install ArgoCD with Helm (recommended for production)
# values.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: argocd

---
# Install with Helm
# helm repo add argo https://argoproj.github.io/argo-helm
# helm install argocd argo/argo-cd -n argocd -f values.yaml

# values.yaml
server:
  replicas: 2
  ingress:
    enabled: true
    ingressClassName: nginx
    hosts:
      - argocd.example.com
    tls:
      - secretName: argocd-tls
        hosts:
          - argocd.example.com

controller:
  replicas: 1
  resources:
    requests:
      cpu: 500m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 1Gi

repoServer:
  replicas: 2
  resources:
    requests:
      cpu: 250m
      memory: 256Mi

redis:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi

configs:
  params:
    server.insecure: false
  rbac:
    policy.csv: |
      g, dev-team, role:readonly
      g, ops-team, role:admin
```

### 2.3 ArgoCD Application Definition

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # Delete resources when app is deleted
spec:
  project: default

  source:
    repoURL: https://github.com/myorg/k8s-manifests.git
    targetRevision: main
    path: overlays/production

  destination:
    server: https://kubernetes.default.svc
    namespace: production

  syncPolicy:
    automated:
      prune: true          # Automatically delete resources removed from Git
      selfHeal: true       # Automatically revert manual changes
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true      # Delete after syncing other resources
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m

  # Health check configuration
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # Prevent conflict with HPA
```

### 2.4 ApplicationSet (Multi-Environment and Multi-Cluster)

```yaml
# ApplicationSet: Deploy to multiple environments at once
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: my-app
  namespace: argocd
spec:
  generators:
    # List type: explicitly define environments
    - list:
        elements:
          - cluster: dev
            url: https://dev-cluster.example.com
            revision: develop
            replicas: "1"
          - cluster: staging
            url: https://staging-cluster.example.com
            revision: main
            replicas: "2"
          - cluster: production
            url: https://prod-cluster.example.com
            revision: main
            replicas: "3"

  template:
    metadata:
      name: 'my-app-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/k8s-manifests.git
        targetRevision: '{{revision}}'
        path: 'overlays/{{cluster}}'
      destination:
        server: '{{url}}'
        namespace: 'my-app-{{cluster}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
```

```yaml
# Git Generator: Auto-generate from directory structure
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: cluster-apps
  namespace: argocd
spec:
  generators:
    - git:
        repoURL: https://github.com/myorg/k8s-manifests.git
        revision: main
        directories:
          - path: 'apps/*'
          - path: 'apps/excluded-app'
            exclude: true

  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/k8s-manifests.git
        targetRevision: main
        path: '{{path}}'
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path.basename}}'
```

### 2.5 Manifest Management with Kustomize

```yaml
# base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: my-app:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
# base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 3000
---
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
commonLabels:
  managed-by: argocd
---
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
resources:
  - ../../base
patchesStrategicMerge:
  - deployment-patch.yaml
  - hpa.yaml
---
# overlays/production/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: app
          image: my-app:v1.2.3  # Pin to a specific production tag
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
---
# overlays/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### 2.6 Helm + ArgoCD

```yaml
# Managing a Helm chart with ArgoCD
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: nginx-ingress
  namespace: argocd
spec:
  project: infrastructure
  source:
    repoURL: https://kubernetes.github.io/ingress-nginx
    chart: ingress-nginx
    targetRevision: 4.8.3
    helm:
      releaseName: nginx-ingress
      values: |
        controller:
          replicaCount: 2
          service:
            type: LoadBalancer
            annotations:
              service.beta.kubernetes.io/aws-load-balancer-type: nlb
          resources:
            requests:
              cpu: 200m
              memory: 256Mi
          metrics:
            enabled: true
  destination:
    server: https://kubernetes.default.svc
    namespace: ingress-nginx
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

---

## 3. Flux

### 3.1 Flux Architecture

```yaml
# flux-system/gotk-components.yaml (auto-generated by Flux Bootstrap)
# Flux consists of the following controllers:

# 1. Source Controller: Watches Git repositories
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myorg/k8s-manifests
  ref:
    branch: main
  secretRef:
    name: git-credentials  # Authentication credentials

# 2. Kustomize Controller: Applies manifests
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 5m
  path: ./overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: my-app
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: my-app
      namespace: production
  timeout: 3m
  retryInterval: 2m
```

### 3.2 Flux Bootstrap

```bash
# Bootstrap Flux (GitHub)
flux bootstrap github \
  --owner=myorg \
  --repository=k8s-manifests \
  --branch=main \
  --path=clusters/production \
  --personal

# Directory structure after bootstrap
k8s-manifests/
├── clusters/
│   └── production/
│       └── flux-system/
│           ├── gotk-components.yaml  # Flux components
│           ├── gotk-sync.yaml        # Self-sync configuration
│           └── kustomization.yaml
├── apps/
│   └── my-app/
│       ├── base/
│       └── overlays/
└── infrastructure/
    ├── cert-manager/
    └── ingress-nginx/
```

### 3.3 Flux Image Automation

```yaml
# Monitor image repository
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  image: ghcr.io/myorg/my-app
  interval: 5m
  secretRef:
    name: ghcr-credentials

---
# Image policy: Select latest using semantic versioning
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: my-app
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: my-app
  policy:
    semver:
      range: ">=1.0.0"

---
# Auto-update configuration: Automatically create commits in Git
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 5m
  sourceRef:
    kind: GitRepository
    name: my-app
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        name: flux-bot
        email: flux@myorg.com
      messageTemplate: 'chore: update {{.AutomationObject}} images'
    push:
      branch: main
  update:
    path: ./overlays/production
    strategy: Setters
```

```yaml
# Set markers in manifests (for image auto-update)
# overlays/production/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: ghcr.io/myorg/my-app:v1.2.3  # {"$imagepolicy": "flux-system:my-app"}
```

### 3.4 Flux Notification Configuration

```yaml
# Slack notification
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: deployments
  secretRef:
    name: slack-webhook

---
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: deployment-alerts
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
    - kind: Kustomization
      name: '*'
    - kind: HelmRelease
      name: '*'
  exclusionList:
    - ".*upgrade.*"  # Exclude upgrade notifications
```

---

## 4. ArgoCD vs Flux Comparison

| Item | ArgoCD | Flux |
|---|---|---|
| UI | Rich built-in Web UI | Separate Weave GitOps UI |
| Multi-cluster | Via ApplicationSet | Remote reference in Kustomization |
| Helm support | Native support | HelmRelease CRD |
| SSO/RBAC | Built-in (OIDC, LDAP) | Delegated to Kubernetes RBAC |
| Image auto-update | Argo Image Updater | Image Automation Controller |
| Architecture | Centralized (Server + UI) | Distributed (CRD-based) |
| Learning curve | Low (intuitive UI) | Medium (requires understanding CRDs) |
| Best suited for | Teams that value UI | Lightweight, CRD-based preference |
| Resource consumption | Medium to large (UI+Server) | Small to medium (Controllers only) |
| CNCF status | Graduated | Graduated |
| Webhook support | Yes (immediate sync trigger) | Yes (Receiver Controller) |

### GitOps Tool Deployment Flow Comparison

| Step | ArgoCD | Flux |
|---|---|---|
| Repository monitoring | Application CRD | GitRepository CRD |
| Drift detection | Every 3 minutes (default) | Every 1 minute (configurable) |
| Manifest generation | Kustomize/Helm/jsonnet | Kustomize/Helm |
| Sync | Sync (automated/manual) | Reconcile (automated) |
| Health checks | Built-in (supports many resource types) | healthChecks field |
| Rollback | One-click from UI | Git revert → auto sync |

### 4.1 Selection Guide

```
GitOps Tool Selection:

Is the team familiar with Kubernetes CRDs?
├── Yes → Consider Flux
│         ├── Want lightweight with low operational cost → Flux
│         ├── Need image auto-update → Flux (Image Automation)
│         └── Fetching manifests from multiple sources → Flux
└── No → Consider ArgoCD
          ├── Want to visualize deployment status via Web UI → ArgoCD
          ├── Want centralized multi-cluster management → ArgoCD (ApplicationSet)
          ├── Need SSO/RBAC → ArgoCD
          └── Want to share deployment status with non-technical staff → ArgoCD
```

---

## 5. Immutable Infrastructure

### 5.1 Mutable vs Immutable

```
Mutable (Traditional):
  SSH to server → Apply patch → Change config → Restart
  Problem: Configuration drift, snowflake servers

  Server v1 → patch → Server v1.1 → patch → Server v1.2
  (Continuously modifying the same server)

Immutable (GitOps):
  Build a new image → Replace old container with new container
  Benefits: Reproducibility, easy rollback, no drift

  Container v1 → Discard
  Container v2 → Create new
  Container v3 → Create new
  (Replace rather than modify)
```

### 5.2 Complete Flow of GitOps + Immutable Infrastructure

```
GitOps + Immutable Infrastructure flow:
  ┌────────┐    ┌────────┐    ┌────────────┐    ┌──────────┐
  │Code    │ →  │CI:Build│ →  │Image Push  │ →  │Manifest  │
  │PR merge│    │Test    │    │ghcr.io/... │    │tag update│
  └────────┘    └────────┘    └────────────┘    └────┬─────┘
                                                      │
                                                      ↓
                                                ┌──────────┐
                                                │Git commit │
                                                │(auto/manual)│
                                                └────┬─────┘
                                                      │
                                                      ↓
                                                ┌──────────┐
                                                │ArgoCD/Flux│
                                                │syncs      │
                                                └────┬─────┘
                                                      │
                                                      ↓
                                                ┌──────────────┐
                                                │ Rolling Update│
                                                │ Old Pod → New Pod│
                                                └──────────────┘
```

### 5.3 Image Tag Strategy

```
Recommended: Guarantee tag immutability

✗ Bad: Overwriting the latest tag
  image: my-app:latest  # Unknown version, cannot rollback

✗ Questionable: Branch name tag
  image: my-app:main    # May be overwritten

○ Good: Git SHA tag
  image: my-app:abc1234  # Immutable, traceable

◎ Best: Semantic version + SHA
  image: my-app:v1.2.3-abc1234  # Version + traceability

  CI configuration for tagging:
    tags:
      - ghcr.io/myorg/my-app:${{ github.sha }}
      - ghcr.io/myorg/my-app:v${{ steps.version.outputs.value }}
```

---

## 6. GitOps Repository Strategy

### 6.1 Monorepo vs Separate Repos

```yaml
# Strategy 1: Monorepo (app code and manifests in the same repository)
my-app/
├── src/                    # Application code
├── Dockerfile
├── k8s/                    # Kubernetes manifests
│   ├── base/
│   └── overlays/
└── .github/workflows/      # CI/CD

# Pros: Simple, review app and infra changes together
# Cons: CI fires frequently on manifest changes, difficult to separate permissions

# Strategy 2: Separate repos (recommended)
my-app/                     # Application repository
├── src/
├── Dockerfile
└── .github/workflows/

k8s-manifests/              # Manifest repository
├── apps/
│   ├── my-app/
│   │   ├── base/
│   │   └── overlays/
│   └── my-api/
├── infrastructure/
│   ├── cert-manager/
│   └── ingress-nginx/
└── clusters/
    ├── dev/
    ├── staging/
    └── production/

# Pros: Separation of concerns, access control, independent CI/CD
# Cons: Requires coordination between repositories
```

### 6.2 Recommended Manifest Repository Structure

```
k8s-manifests/
├── apps/                          # Applications
│   ├── frontend/
│   │   ├── base/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── ingress.yaml
│   │   │   └── kustomization.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       │   ├── kustomization.yaml
│   │       │   └── patch.yaml
│   │       ├── staging/
│   │       └── production/
│   ├── backend/
│   │   ├── base/
│   │   └── overlays/
│   └── worker/
│       ├── base/
│       └── overlays/
├── infrastructure/                # Infrastructure components
│   ├── cert-manager/
│   │   ├── namespace.yaml
│   │   ├── helmrelease.yaml       # Helm release definition
│   │   └── kustomization.yaml
│   ├── ingress-nginx/
│   ├── external-secrets/
│   ├── prometheus-stack/
│   └── kustomization.yaml
├── clusters/                      # Per-cluster configuration
│   ├── dev/
│   │   ├── apps.yaml             # Which apps to deploy
│   │   └── infrastructure.yaml   # Which infra to deploy
│   ├── staging/
│   └── production/
└── README.md
```

---

## 7. Secret Management

In GitOps, all state is stored in Git, but committing secrets (passwords, API keys, etc.) directly to Git is not acceptable from a security standpoint. The following three approaches are mainstream.

### 7.1 Sealed Secrets

```yaml
# Sealed Secrets: Encrypt with the cluster's public key and store in Git
# Encrypted secrets can be committed to Git

# 1. Encrypt a secret with kubeseal
# kubeseal < secret.yaml > sealed-secret.yaml

apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  encryptedData:
    password: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEq...  # Encrypted
    username: AgBy3i4OJSWK+PiTySYZZA9rO43cGDEq...  # Encrypted
  template:
    metadata:
      name: db-credentials
      namespace: production
    type: Opaque
```

### 7.2 External Secrets Operator

```yaml
# External Secrets Operator: Fetch from external secret stores
# Integrates with AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager, etc.

# ClusterSecretStore definition
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
            namespace: external-secrets

---
# ExternalSecret: Fetch secrets from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: db-credentials
    creationPolicy: Owner
  data:
    - secretKey: password
      remoteRef:
        key: prod/db/password
    - secretKey: username
      remoteRef:
        key: prod/db/username
```

### 7.3 SOPS (Secrets OPerationS)

```yaml
# SOPS: Encryption tool developed by Mozilla
# Encrypts with AGE, PGP, AWS KMS, GCP KMS, Azure Key Vault

# .sops.yaml (encryption rules)
creation_rules:
  - path_regex: .*secrets.*\.yaml$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  - path_regex: .*prod.*secrets.*\.yaml$
    kms: arn:aws:kms:ap-northeast-1:123456789012:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Example of encrypted file
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
stringData:
  password: ENC[AES256_GCM,data:xxxxx,iv:xxxxx,tag:xxxxx,type:str]
  username: ENC[AES256_GCM,data:xxxxx,iv:xxxxx,tag:xxxxx,type:str]
sops:
  kms: []
  age:
    - recipient: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      enc: |
        -----BEGIN AGE ENCRYPTED FILE-----
        ...
        -----END AGE ENCRYPTED FILE-----
  lastmodified: "2024-01-15T10:00:00Z"
  version: 3.8.1
```

```yaml
# SOPS integration with Flux
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  decryption:
    provider: sops
    secretRef:
      name: sops-age  # Secret containing the AGE key
  interval: 5m
  path: ./overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: my-app
```

### 7.4 Secret Management Comparison

| Item | Sealed Secrets | External Secrets | SOPS |
|---|---|---|---|
| Encryption location | Within cluster | External service | Local/CI |
| Decryption location | Within cluster | Within cluster | Within cluster |
| Store in Git | Encrypted OK | Reference only | Encrypted OK |
| Rotation | Manual | Automated via external service | Manual |
| Multi-cluster | Re-encrypt per cluster | Shared external store | Shared key encryption |
| Dependencies | Cluster public key | External service | Encryption key |
| Best suited for | Simple configurations | Enterprise | Multi-environment |

---

## 8. Integration Between CI Pipelines and GitOps

### 8.1 Typical Integration Flow

```yaml
# CI for app repository (GitOps integration)
name: CI + GitOps Deploy
on:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test && npm run build

      - name: Build and push Docker image
        id: meta
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest

  update-manifests:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: myorg/k8s-manifests
          token: ${{ secrets.MANIFEST_REPO_TOKEN }}
          ref: main

      - name: Update image tag in manifests
        run: |
          cd overlays/production
          kustomize edit set image \
            my-app=ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Commit and push
        run: |
          git config user.name "ci-bot"
          git config user.email "ci@example.com"
          git add .
          git commit -m "chore: update my-app image to ${{ github.sha }}"
          git push

      # After this, ArgoCD/Flux detects the change and deploys automatically
```

### 8.2 PR-Based Deployment Flow

```yaml
# Deploy to production via PR (safer approach)
name: Create Deploy PR
on:
  push:
    branches: [main]

jobs:
  create-deploy-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          repository: myorg/k8s-manifests
          token: ${{ secrets.MANIFEST_REPO_TOKEN }}

      - name: Create feature branch
        run: |
          BRANCH="deploy/my-app-${{ github.sha }}"
          git checkout -b $BRANCH

      - name: Update image tag
        run: |
          cd overlays/production
          kustomize edit set image \
            my-app=ghcr.io/myorg/my-app:${{ github.sha }}

      - name: Create PR
        run: |
          git add .
          git commit -m "chore: deploy my-app ${{ github.sha }}"
          git push origin $BRANCH
          gh pr create \
            --title "Deploy my-app ${{ github.sha }}" \
            --body "Auto-generated deploy PR for my-app" \
            --base main
        env:
          GH_TOKEN: ${{ secrets.MANIFEST_REPO_TOKEN }}
```

---

## 9. Operations and Troubleshooting

### 9.1 ArgoCD Troubleshooting

```bash
# Check sync status
argocd app get my-app

# Detailed sync logs
argocd app sync my-app --dry-run
argocd app sync my-app --force

# Check diff
argocd app diff my-app

# Check resource status
argocd app resources my-app

# Sync history
argocd app history my-app

# Rollback
argocd app rollback my-app <HISTORY_ID>

# Manually trigger webhook
argocd app sync my-app --revision HEAD
```

### 9.2 Common Issues and Solutions

```
Issue 1: OutOfSync does not resolve
Cause: Missing ignoreDifferences configuration
Fix:
  - HPA changes replicas → Add /spec/replicas to ignoreDifferences
  - Webhook changes Last Applied → Exclude metadata.annotations
  - Operator updates Status → Ignore status field

Issue 2: Sync Failed - ComparisonError
Cause: Manifest syntax error, CRD not installed
Fix:
  - Validate locally with kustomize build
  - Confirm CRDs are installed first
  - Control order with sync-wave annotation

Issue 3: ImagePullBackOff
Cause: Image tag mismatch, registry authentication error
Fix:
  - Verify the image tag is correct
  - Check imagePullSecrets configuration
  - Check token expiration for ECR/GHCR
```

### 9.3 Sync Wave (Controlling Sync Order)

```yaml
# Install CRDs first, then sync applications
apiVersion: v1
kind: Namespace
metadata:
  name: cert-manager
  annotations:
    argocd.argoproj.io/sync-wave: "-2"  # Create first

---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cert-manager
  annotations:
    argocd.argoproj.io/sync-wave: "-1"  # After namespace
spec:
  source:
    repoURL: https://charts.jetstack.io
    chart: cert-manager
    targetRevision: v1.13.3

---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  annotations:
    argocd.argoproj.io/sync-wave: "0"   # After cert-manager
spec:
  source:
    repoURL: https://github.com/myorg/k8s-manifests.git
    path: overlays/production
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Manual Changes That Bypass Git

```
Problem:
  Apply changes directly to the cluster using kubectl apply -f ...

  Git state: replicas: 3
  Cluster state: replicas: 5 (manually changed with kubectl scale)

  → ArgoCD detects the drift and reverts replicas back to 3
  → Or, if selfHeal is disabled, the drift is left unaddressed

Solution:
  - Enable selfHeal: true
  - Configure RBAC to prohibit direct kubectl changes
  - Enforce the rule that all changes go through Git PRs
  - Specify "via PR" in emergency runbooks as well
  - Limit kubectl write access to emergency-only ServiceAccounts
```

### Anti-Pattern 2: Committing Secrets to Git

```
Problem:
  Committing database passwords or API keys in plaintext to Git
  → Security incident

Solutions:
  1. Sealed Secrets: Encrypt with cluster public key and store in Git
  2. External Secrets Operator: Fetch from AWS Secrets Manager, etc.
  3. SOPS (Mozilla): Encrypt and store in Git, decrypt in CI/CD
  4. Vault Agent: Fetch from HashiCorp Vault at runtime
```

### Anti-Pattern 3: Using the latest Tag

```
Problem:
  Running GitOps with image: my-app:latest
  → Unknown which version is deployed
  → Cannot rollback
  → ArgoCD cannot detect drift (same tag but different content)

Solution:
  - Always use immutable tags (Git SHA, semantic version)
  - Do not use imagePullPolicy: Always
  - Manage image tag updates via Git commits
```

### Anti-Pattern 4: Managing All Environments in a Single Application

```
Problem:
  Managing dev/staging/production in a single ArgoCD Application
  → Cannot deploy independently per environment
  → Changes in dev affect production

Solution:
  - Define separate Applications per environment
  - Parameterize environments with ApplicationSet
  - Manage per-environment differences with overlays
```


---

## Hands-On Exercises

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
            raise ValueError("入力値がNoneです")
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
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

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
    print("応用テスト全合格!")

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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be aware of algorithmic complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|--------|------|--------|
| Initialization error | Misconfigured configuration file | Verify configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout value, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check running user permissions, review configuration |
| Data inconsistency | Concurrent processing conflict | Introduce locking mechanism, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace to identify where the error occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Step-by-step verification**: Use log output or a debugger to validate hypotheses
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
    """Decorator that logs function input/output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"呼び出し: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"戻り値: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"例外発生: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("空のデータ")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check I/O wait**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool state

| Issue type | Diagnostic tool | Countermeasure |
|-----------|-----------|------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology decisions.

| Criteria | Prioritize when | Can compromise when |
|---------|------------|-------------|
| Performance | Real-time processing, large-scale data | Admin interfaces, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal data, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing Architecture Patterns

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → Go to ②             │
│                                                 │
│  ② What is the deployment frequency?            │
│    ├─ Weekly or less → Monolith + module split  │
│    └─ Daily/multiple times → Go to ③           │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A faster short-term approach can become technical debt in the long run
- Conversely, over-engineering increases short-term cost and can delay projects

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows using the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- Higher abstraction improves reusability but can make debugging harder
- Lower abstraction is intuitive but tends to lead to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and problem"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## 背景\n{self.context}\n\n"
        md += f"## 決定\n{self.decision}\n\n"
        md += "## 結果\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## 却下した代替案\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```

---

## Real-World Application Scenarios

### Scenario 1: MVP Development at a Startup

**Situation:** Need to release a product quickly with limited resources

**Approach:**
- Choose a simple architecture
- Focus on the minimum required features
- Automate tests only for critical paths
- Introduce monitoring early

**Lessons Learned:**
- Do not strive for perfection (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Modernizing a Legacy System

**Situation:** Gradually replacing a system that has been running for over 10 years

**Approach:**
- Migrate incrementally using the Strangler Fig pattern
- Create Characterization Tests first if existing tests are absent
- Coexist old and new systems with an API gateway
- Perform data migration incrementally

| Phase | Tasks | Estimated Duration | Risk |
|---------|---------|---------|--------|
| 1. Investigation | Current state analysis, dependency mapping | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Start migration | Migrate peripheral features first | 3-6 months | Medium |
| 4. Core migration | Migrate core features | 6-12 months | High |
| 5. Completion | Decommission old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers working on the same product

**Approach:**
- Use domain-driven design to clarify boundaries
- Assign ownership per team
- Manage shared libraries via Inner Source model
- Design API-first to minimize inter-team dependencies

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

**Situation:** A system requiring millisecond-level responses

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leverage asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization technique | Effect | Implementation cost | When to apply |
|-----------|------|-----------|---------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | Slow queries |
| Code optimization | Low-Medium | High | CPU-bound cases |
---

## 11. FAQ

### Q1: Can GitOps be used outside of Kubernetes?

In principle, yes. The essence of GitOps is "using Git as the Single Source of Truth to automatically sync declarative state," which is not limited to Kubernetes. It is also possible to apply GitOps to infrastructure using Terraform + Atlantis/Spacelift, or manage any cloud resource as Kubernetes CRDs with Crossplane. However, the maturity of tooling is highest within the Kubernetes ecosystem.

### Q2: How do you perform a rollback in GitOps?

Use `git revert` to create a new commit reverting to the previous version, then merge the PR. ArgoCD/Flux detects the change and syncs automatically. This has the advantage that "rollbacks also remain in the Git history." In ArgoCD's UI, you can also directly rollback to a previous sync point. However, if the rollback involves database migrations, a simple revert is not sufficient and a separate procedure is required.

### Q3: How do CI pipelines integrate with GitOps?

A typical flow is: (1) CI builds, tests, and pushes images in the app repository; (2) CI automatically creates a PR in the manifest repository (updating the image tag); (3) PR review and merge; (4) ArgoCD/Flux syncs automatically. The key is the separation of responsibilities: CI handles up to image creation, and the GitOps agent handles deployment.

### Q4: How are DB migrations handled in GitOps?

DB migrations are imperative rather than declarative, so they do not fully align with GitOps principles. Common approaches are: (1) Run migrations in an Init Container; (2) Run migrations as a Kubernetes Job; (3) Run migrations in ArgoCD's PreSync Hook. In all cases, it is important to define a rollback strategy in advance.

### Q5: How do you design multi-cluster GitOps?

For ArgoCD, use ApplicationSet to specify different parameters per cluster (URL, environment name, replica count, etc.). A Hub-and-Spoke model (controlling each cluster from a central management cluster) is common. For Flux, install Flux on each cluster and have it reference different paths in the same Git repository (clusters/dev/, clusters/prod/).

### Q6: How do you gradually introduce GitOps?

Phase 1: GitOps for the development environment only (install ArgoCD/Flux, sync one app). Phase 2: Expand to staging (multi-environment with ApplicationSet). Phase 3: Apply to production (Protection Rules, secret management). Phase 4: Also GitOps-ify infrastructure components (cert-manager, ingress, etc.). Confirm stable operation for 1-2 months at each phase before proceeding to the next.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in daily development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|---|---|
| Essence of GitOps | Git is the single source of truth, declarative, pull-based, auto-reconcile |
| Benefits of pull-based | Localized credentials, automatic drift repair, audit trail |
| ArgoCD | Rich UI, multi-cluster, ApplicationSet, intuitive |
| Flux | Lightweight, CRD-based, image auto-update, SOPS integration |
| Immutable | Replace rather than modify, immutable tags required |
| Secret management | Sealed Secrets / External Secrets / SOPS |
| Repository strategy | Separate app and manifests (recommended) |
| CI integration | CI handles up to image creation; GitOps agent handles deployment |
| Troubleshooting | argocd app diff/sync, check logs, sync-wave |

---

## What to Read Next

- [Container Deployment](../02-deployment/02-container-deployment.md) -- Deployment practice on Kubernetes
- [Deployment Strategies](../02-deployment/00-deployment-strategies.md) -- Combining with Canary, Blue-Green
- [Actions Security](../01-github-actions/04-security-actions.md) -- OIDC integration and secure CI
- [Infrastructure as Code](./02-infrastructure-as-code.md) -- Integration of IaC and GitOps

---

## References

1. OpenGitOps. "GitOps Principles." https://opengitops.dev/
2. Argo Project. "Argo CD - Declarative GitOps CD for Kubernetes." https://argo-cd.readthedocs.io/
3. Fluxcd. "Flux - the GitOps family of projects." https://fluxcd.io/docs/
4. Weaveworks. "Guide To GitOps." https://www.weave.works/technologies/gitops/
5. Cornelia Davis. *Cloud Native Patterns*. Manning Publications, 2019.
6. Bilgin Ibryam, Roland Hub. *Kubernetes Patterns*, 2nd Edition. O'Reilly Media, 2023.
7. External Secrets Operator. "ESO Documentation." https://external-secrets.io/
8. Bitnami Labs. "Sealed Secrets." https://github.com/bitnami-labs/sealed-secrets
