# Amazon EKS Overview

> A systematic guide covering Amazon Elastic Kubernetes Service (EKS) cluster creation, node groups, Fargate profiles, Helm, and IRSA (IAM Roles for Service Accounts). This guide provides comprehensive practical operational knowledge including EKS add-on management, Cluster Autoscaler / Karpenter, network policies, observability, security, and GitOps.

---

## What You Will Learn

1. **EKS Cluster Configuration and Creation** -- Understand the relationship between the control plane and data plane, and learn cluster setup with eksctl
2. **Node Groups and Fargate Profiles** -- Master the use cases for managed node groups, self-managed nodes, and Fargate
3. **Using Helm and IRSA** -- Learn application deployment with a package manager and Pod-level IAM permission control
4. **EKS Add-ons and Auto Scaling** -- Learn cluster operations automation using managed add-ons, Cluster Autoscaler, and Karpenter
5. **Security and Networking** -- Understand practical implementation of Pod Security Standards, network policies, and Secrets management
6. **Observability and GitOps** -- Master operational patterns using Container Insights, Prometheus, ArgoCD/Flux


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Understanding of the content in [Amazon ECR (Elastic Container Registry)](./01-ecr.md)

---

## 1. EKS Architecture

### 1.1 Overall Structure

```
+----------------------------------------------------------+
|  Amazon EKS Cluster                                       |
|                                                          |
|  Control Plane (AWS Managed)                             |
|  +------------------------------------------------------+|
|  | +--------+ +----------+ +----------+ +-----------+   ||
|  | | kube-  | | kube-    | | kube-    | | etcd      |   ||
|  | | api-   | | scheduler| | controller| | (3 AZ)   |   ||
|  | | server | |          | | manager  | |           |   ||
|  | +--------+ +----------+ +----------+ +-----------+   ||
|  +------------------------------------------------------+|
|           |                                              |
|           | (ENI / API Endpoint)                         |
|           |                                              |
|  Data Plane (User Managed)                               |
|  +------------------------------------------------------+|
|  | Managed Node Group          Fargate                  ||
|  | +----------+ +----------+ +-----------+              ||
|  | | EC2 Node | | EC2 Node | | Fargate   |              ||
|  | | +------+ | | +------+ | | Pod       |              ||
|  | | | Pod  | | | | Pod  | | |           |              ||
|  | | | Pod  | | | | Pod  | | +-----------+              ||
|  | | +------+ | | +------+ | +-----------+              ||
|  | | kubelet  | | kubelet  | | Fargate   |              ||
|  | +----------+ +----------+ | Pod       |              ||
|  |                           +-----------+              ||
|  +------------------------------------------------------+|
+----------------------------------------------------------+
```

### 1.2 EKS vs ECS Comparison

| Feature | EKS | ECS |
|---------|-----|-----|
| Orchestrator | Kubernetes | AWS proprietary |
| Learning curve | High | Low |
| Portability | High (K8s compatible) | AWS-specific |
| Ecosystem | Very broad (CNCF) | Tight AWS service integration |
| Control plane cost | $0.10/hr (~$73/mo) | Free |
| Configuration flexibility | Very high | Moderate |
| Operational complexity | High | Low |
| Best suited for | K8s experience / multi-cloud | AWS-centric / small teams |

### 1.3 EKS Network Architecture

```
EKS Network Configuration:

+------------------------------------------------------------------+
|  VPC (10.0.0.0/16)                                                |
|                                                                  |
|  Public Subnets                                                   |
|  +---------------------+  +---------------------+                 |
|  | 10.0.1.0/24 (AZ-a)  |  | 10.0.2.0/24 (AZ-c)  |                |
|  | +------+  +------+  |  | +------+  +------+  |                |
|  | | NLB  |  | NAT  |  |  | | NLB  |  | NAT  |  |                |
|  | | (K8s |  | GW   |  |  | | (K8s |  | GW   |  |                |
|  | | Svc) |  |      |  |  | | Svc) |  |      |  |                |
|  | +------+  +------+  |  | +------+  +------+  |                |
|  +---------------------+  +---------------------+                 |
|                                                                  |
|  Private Subnets                                                  |
|  +---------------------+  +---------------------+                 |
|  | 10.0.10.0/24 (AZ-a) |  | 10.0.20.0/24 (AZ-c) |                |
|  | +------+ +------+   |  | +------+ +------+   |                |
|  | | Node | | Node |   |  | | Node | | Node |   |                |
|  | | +--+ | | +--+ |   |  | | +--+ | | +--+ |   |                |
|  | | |P | | | |P | |   |  | | |P | | | |P | |   |                |
|  | | +--+ | | +--+ |   |  | | +--+ | | +--+ |   |                |
|  | +------+ +------+   |  | +------+ +------+   |                |
|  +---------------------+  +---------------------+                 |
|                                                                  |
|  ENI (for control plane communication)                            |
|  +---------------------+  +---------------------+                 |
|  | 10.0.100.0/24       |  | 10.0.200.0/24       |                |
|  +---------------------+  +---------------------+                 |
+------------------------------------------------------------------+
```

### 1.4 EKS API Endpoint Access Control

```bash
# Public + Private endpoint (recommended)
aws eks update-cluster-config \
  --name my-cluster \
  --resources-vpc-config \
    endpointPublicAccess=true,\
    endpointPrivateAccess=true,\
    publicAccessCidrs='["203.0.113.0/24","198.51.100.0/24"]'

# Private endpoint only (most secure)
aws eks update-cluster-config \
  --name my-cluster \
  --resources-vpc-config \
    endpointPublicAccess=false,\
    endpointPrivateAccess=true
```

```
API Endpoint Options:

Public only:
  kubectl → Internet → EKS API
  ⚠ Security risk

Public + Private (recommended):
  kubectl (external) → Internet → EKS API (CIDR restricted)
  kubectl (within VPC) → ENI → EKS API (private)

Private only:
  kubectl → VPN/DirectConnect → VPC → ENI → EKS API
  ✓ Most secure / VPN required
```

---

## 2. Cluster Creation

### 2.1 Creating a Cluster with eksctl

```yaml
# cluster-config.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: my-cluster
  region: ap-northeast-1
  version: "1.29"

vpc:
  cidr: "10.0.0.0/16"
  nat:
    gateway: HighlyAvailable  # NAT GW in each AZ

managedNodeGroups:
  - name: general-purpose
    instanceType: m5.large
    desiredCapacity: 3
    minSize: 2
    maxSize: 10
    volumeSize: 50
    volumeType: gp3
    labels:
      role: general
    tags:
      Environment: production
    iam:
      withAddonPolicies:
        albIngress: true
        cloudWatch: true

  - name: spot-workers
    instanceTypes:
      - m5.large
      - m5a.large
      - m4.large
    spot: true
    desiredCapacity: 5
    minSize: 0
    maxSize: 20
    labels:
      role: spot-worker

fargateProfiles:
  - name: default
    selectors:
      - namespace: fargate-tasks
        labels:
          compute: fargate

cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler
```

```bash
# Create cluster
eksctl create cluster -f cluster-config.yaml

# Configure kubeconfig
aws eks update-kubeconfig --name my-cluster --region ap-northeast-1

# Verify cluster information
kubectl cluster-info
kubectl get nodes
```

### 2.2 Creating a Cluster with AWS CLI

```bash
# 1. Create cluster role
aws iam create-role \
  --role-name eksClusterRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "eks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name eksClusterRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

# 2. Create cluster
aws eks create-cluster \
  --name my-cluster \
  --role-arn arn:aws:iam::123456789012:role/eksClusterRole \
  --resources-vpc-config \
    subnetIds=subnet-111,subnet-222,subnet-333,\
securityGroupIds=sg-12345678 \
  --kubernetes-version 1.29
```

### 2.3 Advanced eksctl Configuration Example

```yaml
# production-cluster.yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: production-cluster
  region: ap-northeast-1
  version: "1.29"
  tags:
    Environment: production
    Team: platform

# Secrets encryption with KMS
secretsEncryption:
  keyARN: arn:aws:kms:ap-northeast-1:123456789012:key/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# VPC configuration
vpc:
  cidr: "10.0.0.0/16"
  nat:
    gateway: HighlyAvailable
  clusterEndpoints:
    publicAccess: true
    privateAccess: true
  publicAccessCIDRs:
    - "203.0.113.0/24"

# IAM OIDC provider (for IRSA)
iam:
  withOIDC: true
  serviceAccounts:
    - metadata:
        name: aws-load-balancer-controller
        namespace: kube-system
      wellKnownPolicies:
        awsLoadBalancerController: true
    - metadata:
        name: external-dns
        namespace: kube-system
      wellKnownPolicies:
        externalDNS: true
    - metadata:
        name: cluster-autoscaler
        namespace: kube-system
      wellKnownPolicies:
        autoScaler: true

# Managed add-ons
addons:
  - name: vpc-cni
    version: latest
    configurationValues: '{"env":{"ENABLE_PREFIX_DELEGATION":"true"}}'
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest
    serviceAccountRoleARN: arn:aws:iam::123456789012:role/ebs-csi-role

# Node groups
managedNodeGroups:
  - name: system
    instanceType: m5.large
    desiredCapacity: 3
    minSize: 3
    maxSize: 6
    volumeSize: 100
    volumeType: gp3
    volumeEncrypted: true
    labels:
      role: system
    taints:
      - key: CriticalAddonsOnly
        value: "true"
        effect: PreferNoSchedule
    privateNetworking: true
    iam:
      withAddonPolicies:
        albIngress: true
        cloudWatch: true
        ebs: true

  - name: app-on-demand
    instanceType: m5.xlarge
    desiredCapacity: 3
    minSize: 2
    maxSize: 20
    volumeSize: 100
    volumeType: gp3
    volumeEncrypted: true
    labels:
      role: application
      lifecycle: on-demand
    privateNetworking: true
    ssh:
      allow: false

  - name: app-spot
    instanceTypes:
      - m5.xlarge
      - m5a.xlarge
      - m5d.xlarge
      - m4.xlarge
    spot: true
    desiredCapacity: 5
    minSize: 0
    maxSize: 30
    volumeSize: 100
    labels:
      role: application
      lifecycle: spot
    taints:
      - key: spot
        value: "true"
        effect: NoSchedule
    privateNetworking: true

# Logging configuration
cloudWatch:
  clusterLogging:
    enableTypes:
      - api
      - audit
      - authenticator
      - controllerManager
      - scheduler
    logRetentionInDays: 90
```

### 2.4 Cluster Version Upgrade

```bash
# Check current version
aws eks describe-cluster \
  --name my-cluster \
  --query 'cluster.version'

# Upgrade control plane
aws eks update-cluster-version \
  --name my-cluster \
  --kubernetes-version 1.30

# Check upgrade status
aws eks describe-update \
  --name my-cluster \
  --update-id <update-id>

# Check add-on compatibility
aws eks describe-addon-versions \
  --kubernetes-version 1.30 \
  --addon-name vpc-cni

# Upgrade add-on
aws eks update-addon \
  --cluster-name my-cluster \
  --addon-name vpc-cni \
  --addon-version v1.16.0-eksbuild.1 \
  --resolve-conflicts OVERWRITE

# Upgrade managed node group
aws eks update-nodegroup-version \
  --cluster-name my-cluster \
  --nodegroup-name general-ng \
  --kubernetes-version 1.30

# Check node group upgrade status
aws eks describe-nodegroup \
  --cluster-name my-cluster \
  --nodegroup-name general-ng \
  --query 'nodegroup.{version:version,status:status}'
```

```
EKS Version Upgrade Steps:

1. Review release notes
   ↓  Check for deprecated APIs and breaking changes
2. Test in staging environment
   ↓  Application compatibility testing
3. Check add-on compatibility
   ↓  Compatible versions for vpc-cni, coredns, kube-proxy
4. Upgrade control plane
   ↓  Approx. 20-30 minutes (no downtime)
5. Upgrade add-ons
   ↓  Update each add-on sequentially
6. Upgrade node groups
   ↓  Rolling update (drain Pods → launch new nodes)
7. Verify application behavior

⚠ Upgrade one version at a time (1.28 → 1.29 → 1.30)
⚠ Control plane and data plane can differ by at most 2 minor versions
```

---

## 3. Node Groups

### 3.1 Node Type Comparison

```
Node Options:

+-------------------+     +-------------------+     +-------------------+
| Managed Node      |     | Self-Managed      |     | Fargate           |
| Group             |     | Nodes             |     |                   |
+-------------------+     +-------------------+     +-------------------+
| EC2 management    |     | EC2 fully managed |     | Serverless        |
| assisted by AWS   |     | by user           |     | Pod-level exec    |
|                   |     |                   |     |                   |
| AMI updates: semi |     | AMI updates:      |     | AMI mgmt: none    |
| ASG mgmt: auto    |     | ASG mgmt: manual  |     | Scaling: auto     |
| Drain: auto       |     | Drain: manual     |     | DaemonSet: N/A    |
+-------------------+     +-------------------+     +-------------------+
```

| Feature | Managed Node Group | Self-Managed | Fargate |
|---------|-------------------|--------------|---------|
| Infrastructure management | Low | High | None |
| Customizability | Medium | High | Low |
| GPU support | Yes | Yes | No |
| DaemonSet | Yes | Yes | No |
| Launch speed | Medium (EC2 startup) | Medium | Somewhat slow |
| Cost | EC2 pricing | EC2 pricing | vCPU+memory billing |

### 3.2 Creating a Managed Node Group

```bash
# Create node role
aws iam create-role \
  --role-name eksNodeRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach required policies
aws iam attach-role-policy --role-name eksNodeRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
aws iam attach-role-policy --role-name eksNodeRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
aws iam attach-role-policy --role-name eksNodeRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# Create node group
aws eks create-nodegroup \
  --cluster-name my-cluster \
  --nodegroup-name general-ng \
  --node-role arn:aws:iam::123456789012:role/eksNodeRole \
  --subnets subnet-111 subnet-222 subnet-333 \
  --instance-types m5.large \
  --scaling-config minSize=2,maxSize=10,desiredSize=3 \
  --disk-size 50 \
  --capacity-type ON_DEMAND
```

### 3.3 Using Custom Launch Templates

```bash
# Create node group with Launch Template
# Allows fine-grained control of custom AMI, UserData, security groups, etc.

aws ec2 create-launch-template \
  --launch-template-name eks-custom-lt \
  --launch-template-data '{
    "BlockDeviceMappings": [
      {
        "DeviceName": "/dev/xvda",
        "Ebs": {
          "VolumeSize": 100,
          "VolumeType": "gp3",
          "Iops": 3000,
          "Throughput": 125,
          "Encrypted": true,
          "KmsKeyId": "arn:aws:kms:ap-northeast-1:123456789012:key/xxx"
        }
      }
    ],
    "MetadataOptions": {
      "HttpTokens": "required",
      "HttpPutResponseHopLimit": 2,
      "HttpEndpoint": "enabled"
    },
    "TagSpecifications": [
      {
        "ResourceType": "instance",
        "Tags": [
          {"Key": "Environment", "Value": "production"}
        ]
      }
    ]
  }'

# Create node group using Launch Template
aws eks create-nodegroup \
  --cluster-name my-cluster \
  --nodegroup-name custom-ng \
  --node-role arn:aws:iam::123456789012:role/eksNodeRole \
  --subnets subnet-111 subnet-222 \
  --launch-template name=eks-custom-lt,version=1 \
  --scaling-config minSize=2,maxSize=10,desiredSize=3
```

### 3.4 Bottlerocket Nodes

```yaml
# Bottlerocket node group with eksctl
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: my-cluster
  region: ap-northeast-1

managedNodeGroups:
  - name: bottlerocket-ng
    amiFamily: Bottlerocket
    instanceType: m5.large
    desiredCapacity: 3
    minSize: 2
    maxSize: 10
    volumeSize: 50
    bottlerocket:
      settings:
        kubernetes:
          maxPods: 58
        host-containers:
          admin:
            enabled: true
          control:
            enabled: true
```

```
Bottlerocket vs Amazon Linux 2:

Bottlerocket:
  ✓ Lightweight OS specialized for container execution
  ✓ Immutable infrastructure
  ✓ Automatic security updates
  ✓ No SSH required (admin container via SSM)
  ✓ Smaller attack surface
  ✗ General-purpose package installation not possible
  ✗ Some custom configurations are restricted

Amazon Linux 2:
  ✓ General-purpose and flexible
  ✓ Package installation via yum
  ✓ Existing operational tools are compatible
  ✗ OS patch management required
  ✗ Higher security management burden
```

---

## 4. Fargate Profiles

### 4.1 How Fargate Profiles Work

```
Fargate Pod Scheduling:

Pod creation request
    |
    v
+----------------------------+
| EKS Scheduler              |
| Checks Fargate profiles    |
+----------------------------+
    |
    | Does namespace + labels match?
    |
 +--+--+
 |     |
Match  No match
 |     |
 v     v
Fargate  EC2 Node
execute  execute

Fargate Profile:
  namespace: "batch-jobs"
  labels:
    compute: "fargate"
```

### 4.2 Creating a Fargate Profile

```bash
# Fargate Pod execution role
aws iam create-role \
  --role-name eksFargatePodRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "eks-fargate-pods.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy --role-name eksFargatePodRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy

# Create Fargate profile
aws eks create-fargate-profile \
  --cluster-name my-cluster \
  --fargate-profile-name batch-profile \
  --pod-execution-role-arn arn:aws:iam::123456789012:role/eksFargatePodRole \
  --subnets subnet-111 subnet-222 \
  --selectors '[
    {
      "namespace": "batch-jobs",
      "labels": {"compute": "fargate"}
    }
  ]'
```

### 4.3 Fargate Limitations and Workarounds

```
Fargate Limitations:

1. DaemonSet is not supported
   → Use sidecar containers as an alternative
   → Use Fluent Bit sidecar for log forwarding

2. HostPort / HostNetwork is not supported
   → Use Service (LoadBalancer/ClusterIP) instead

3. EBS volumes are not supported
   → Use EFS (Elastic File System)
   → emptyDir can be used temporarily

4. GPU is not supported
   → Route GPU workloads to EC2 nodes

5. Privileged Containers are not supported
   → Security context restrictions apply

6. Slow startup (30 seconds to 2 minutes)
   → Use EC2 nodes for latency-sensitive workloads
```

```yaml
# Fluent Bit sidecar example for Fargate
apiVersion: v1
kind: Pod
metadata:
  name: app-with-logging
  namespace: batch-jobs
  labels:
    compute: fargate
spec:
  containers:
    - name: app
      image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1.0
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app

    - name: fluent-bit
      image: public.ecr.aws/aws-observability/aws-for-fluent-bit:stable
      env:
        - name: AWS_REGION
          value: ap-northeast-1
      volumeMounts:
        - name: log-volume
          mountPath: /var/log/app
          readOnly: true
        - name: fluent-bit-config
          mountPath: /fluent-bit/etc/

  volumes:
    - name: log-volume
      emptyDir: {}
    - name: fluent-bit-config
      configMap:
        name: fluent-bit-config
```

### 4.4 Logging on Fargate (FireLens)

```yaml
# ConfigMap to send Fargate Pod logs to CloudWatch
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-logging
  namespace: aws-observability
data:
  output.conf: |
    [OUTPUT]
        Name  cloudwatch_logs
        Match *
        region ap-northeast-1
        log_group_name /eks/fargate/my-cluster
        log_stream_prefix fargate-
        auto_create_group true
        log_retention_days 30

  parsers.conf: |
    [PARSER]
        Name json
        Format json
        Time_Key time
        Time_Format %Y-%m-%dT%H:%M:%S.%LZ

  filters.conf: |
    [FILTER]
        Name parser
        Match *
        Key_Name log
        Parser json
        Reserve_Data On
```

---

## 5. Helm

### 5.1 Helm Concepts

```
Helm Components:

Chart (Package):
  my-chart/
  ├── Chart.yaml          # Chart metadata
  ├── values.yaml         # Default configuration values
  ├── templates/          # Kubernetes manifest templates
  │   ├── deployment.yaml
  │   ├── service.yaml
  │   ├── ingress.yaml
  │   └── _helpers.tpl    # Template helpers
  └── charts/             # Dependent charts

Release (Installed instance):
  helm install my-release my-chart --values custom-values.yaml
```

### 5.2 Application Deployment with Helm

```bash
# Add Helm repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Search for charts
helm search repo nginx

# Install (NGINX Ingress Controller example)
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/aws-load-balancer-type"=nlb

# Install with custom values file
helm install my-app ./my-chart \
  --namespace production \
  --create-namespace \
  --values production-values.yaml

# Upgrade
helm upgrade my-app ./my-chart \
  --namespace production \
  --values production-values.yaml

# Rollback
helm rollback my-app 1 --namespace production

# List releases
helm list --all-namespaces
```

### 5.3 values.yaml Example

```yaml
# production-values.yaml
replicaCount: 3

image:
  repository: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app
  tag: "v1.2.3"
  pullPolicy: IfNotPresent

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: alb
  annotations:
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
  hosts:
    - host: api.example.com
      paths:
        - path: /
          pathType: Prefix

serviceAccount:
  create: true
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/my-app-role
```

### 5.4 Creating a Helm Chart

```bash
# Scaffold a new Chart
helm create my-web-app

# Generated structure
# my-web-app/
# ├── Chart.yaml
# ├── values.yaml
# ├── charts/
# ├── templates/
# │   ├── NOTES.txt
# │   ├── _helpers.tpl
# │   ├── deployment.yaml
# │   ├── hpa.yaml
# │   ├── ingress.yaml
# │   ├── service.yaml
# │   ├── serviceaccount.yaml
# │   └── tests/
# │       └── test-connection.yaml
# └── .helmignore
```

```yaml
# Chart.yaml
apiVersion: v2
name: my-web-app
description: A Helm chart for my web application
type: application
version: 0.1.0
appVersion: "1.0.0"
dependencies:
  - name: redis
    version: "17.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-web-app.fullname" . }}
  labels:
    {{- include "my-web-app.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "my-web-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      annotations:
        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
      labels:
        {{- include "my-web-app.selectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ include "my-web-app.serviceAccountName" . }}
      securityContext:
        runAsNonRoot: true
        fsGroup: 1000
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.containerPort | default 8080 }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          envFrom:
            - configMapRef:
                name: {{ include "my-web-app.fullname" . }}-config
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

```bash
# Test Chart
helm template my-app ./my-web-app --values production-values.yaml

# Lint check
helm lint ./my-web-app

# Package Chart
helm package ./my-web-app

# Push Chart to OCI registry (ECR)
aws ecr create-repository --repository-name helm-charts/my-web-app
helm push my-web-app-0.1.0.tgz oci://123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/helm-charts
```

---

## 6. IRSA (IAM Roles for Service Accounts)

### 6.1 How IRSA Works

```
IRSA Authentication Flow:

1. At Pod startup, retrieve the IAM role ARN
   annotated on the ServiceAccount

2. EKS integrates with STS via the OIDC provider

3. The application inside the Pod automatically
   obtains temporary credentials using the AWS SDK

+--------+     +--------+     +---------+     +-----+
| Pod    | --> | OIDC   | --> | AWS STS | --> | IAM |
| (SDK)  |     |Provider|     |AssumeRole|     |Role |
+--------+     +--------+     +---------+     +-----+
    |                                            |
    | AWS_WEB_IDENTITY_TOKEN_FILE                 |
    | AWS_ROLE_ARN                               |
    v                                            v
+--------+                                  +--------+
|Temp    | <------------------------------- |Perms   |
|creds   |                                  |granted |
+--------+                                  +--------+
```

### 6.2 IRSA Setup Steps

```bash
# 1. Create OIDC provider (once per cluster creation)
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster \
  --approve

# 2. Create IAM policy
aws iam create-policy \
  --policy-name my-app-s3-policy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::my-bucket/*"
    }]
  }'

# 3. Link ServiceAccount with IAM role
eksctl create iamserviceaccount \
  --cluster my-cluster \
  --namespace production \
  --name my-app-sa \
  --attach-policy-arn arn:aws:iam::123456789012:policy/my-app-s3-policy \
  --approve

# 4. Specify ServiceAccount in Pod
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  namespace: production
spec:
  serviceAccountName: my-app-sa
  containers:
    - name: app
      image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1.0
EOF
```

### 6.3 IRSA IAM Role Trust Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.ap-northeast-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.ap-northeast-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:sub": "system:serviceaccount:production:my-app-sa",
          "oidc.eks.ap-northeast-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

### 6.4 EKS Pod Identity (Successor to IRSA)

```bash
# Create EKS Pod Identity Association (simpler than IRSA)
# No OIDC provider configuration required

# 1. Install Pod Identity Agent add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name eks-pod-identity-agent

# 2. IAM role trust policy (for Pod Identity)
aws iam create-role \
  --role-name my-app-pod-identity-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Service": "pods.eks.amazonaws.com"
      },
      "Action": [
        "sts:AssumeRole",
        "sts:TagSession"
      ]
    }]
  }'

# 3. Create Pod Identity Association
aws eks create-pod-identity-association \
  --cluster-name my-cluster \
  --namespace production \
  --service-account my-app-sa \
  --role-arn arn:aws:iam::123456789012:role/my-app-pod-identity-role

# 4. Create ServiceAccount (no annotation needed!)
kubectl create serviceaccount my-app-sa -n production
```

```
IRSA vs EKS Pod Identity:

IRSA:
  ✓ Mature mechanism, widely documented
  ✗ Requires OIDC provider setup per cluster
  ✗ IAM role trust policy requires cluster-specific OIDC URL
  ✗ Migration between clusters is cumbersome

EKS Pod Identity (recommended):
  ✓ No OIDC provider required
  ✓ Simpler IAM role trust policy
  ✓ Easy migration between clusters
  ✓ No ServiceAccount annotation required
  ✗ Relatively new feature (since November 2023)
  ✗ Not supported for Fargate (use IRSA)
```

---

## 7. EKS Managed Add-ons

### 7.1 Key Managed Add-ons

```bash
# List available add-ons
aws eks describe-addon-versions \
  --kubernetes-version 1.29 \
  --query 'addons[].{name:addonName,versions:addonVersions[0].addonVersion}' \
  --output table

# Install add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name vpc-cni \
  --addon-version v1.16.0-eksbuild.1 \
  --service-account-role-arn arn:aws:iam::123456789012:role/vpc-cni-role

# Check add-on status
aws eks describe-addon \
  --cluster-name my-cluster \
  --addon-name vpc-cni

# Update add-on
aws eks update-addon \
  --cluster-name my-cluster \
  --addon-name vpc-cni \
  --addon-version v1.17.0-eksbuild.1 \
  --resolve-conflicts OVERWRITE
```

```
Key Add-ons List:

Essential Add-ons:
  vpc-cni          Pod networking (ENI-based)
  coredns          In-cluster DNS
  kube-proxy       Network proxy

Storage:
  aws-ebs-csi-driver    EBS volumes
  aws-efs-csi-driver    EFS volumes

Security:
  eks-pod-identity-agent  Pod Identity
  aws-guardduty-agent     Threat detection

Networking:
  aws-load-balancer-controller  ALB/NLB management (※Installed via Helm)

Observability:
  amazon-cloudwatch-observability  Container Insights
  adot                             AWS Distro for OpenTelemetry
```

### 7.2 Advanced VPC CNI Configuration

```bash
# Enable Prefix Delegation (improves Pod density)
# Normal: Assign one IP per ENI
# Prefix: Assign /28 prefix (16 IPs) per ENI
kubectl set env daemonset aws-node \
  -n kube-system \
  ENABLE_PREFIX_DELEGATION=true \
  WARM_PREFIX_TARGET=1

# Custom networking (run Pods in separate subnets)
kubectl set env daemonset aws-node \
  -n kube-system \
  AWS_VPC_K8S_CNI_CUSTOM_NETWORK_CFG=true

# Create ENIConfig resource
kubectl apply -f - <<EOF
apiVersion: crd.k8s.amazonaws.com/v1alpha1
kind: ENIConfig
metadata:
  name: ap-northeast-1a
spec:
  subnet: subnet-pod-az-a
  securityGroups:
    - sg-pod-sg
EOF
```

```
VPC CNI IP Address Management:

Normal mode (Secondary IP):
  m5.large: 3 ENIs × 10 IPs = max 29 Pods

Prefix Delegation mode:
  m5.large: 3 ENIs × /28 prefix = max 110 Pods
  → Pod density improves approximately 4x

Custom networking:
  Node: 10.0.0.0/16 (VPC CIDR)
  Pod:  100.64.0.0/16 (separate CIDR)
  → Avoids VPC IP address exhaustion
```

---

## 8. Auto Scaling

### 8.1 Cluster Autoscaler

```yaml
# Deploy Cluster Autoscaler (Helm)
# values.yaml
autoDiscovery:
  clusterName: my-cluster

awsRegion: ap-northeast-1

rbac:
  serviceAccount:
    create: true
    annotations:
      eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/cluster-autoscaler-role

extraArgs:
  balance-similar-node-groups: true
  skip-nodes-with-system-pods: false
  expander: least-waste
  scale-down-delay-after-add: 10m
  scale-down-unneeded-time: 10m
  max-graceful-termination-sec: 600
```

```bash
# Install with Helm
helm repo add autoscaler https://kubernetes.github.io/autoscaler
helm install cluster-autoscaler autoscaler/cluster-autoscaler \
  --namespace kube-system \
  --values ca-values.yaml

# Verify operation
kubectl logs -f deployment/cluster-autoscaler -n kube-system
```

### 8.2 Karpenter (Recommended)

```bash
# Install Karpenter
export KARPENTER_VERSION="v0.33.0"
export CLUSTER_NAME="my-cluster"
export AWS_ACCOUNT_ID="123456789012"
export TEMPOUT=$(mktemp)

helm upgrade --install karpenter oci://public.ecr.aws/karpenter/karpenter \
  --version "${KARPENTER_VERSION}" \
  --namespace karpenter \
  --create-namespace \
  --set "settings.clusterName=${CLUSTER_NAME}" \
  --set "settings.interruptionQueue=${CLUSTER_NAME}" \
  --set controller.resources.requests.cpu=1 \
  --set controller.resources.requests.memory=1Gi \
  --set controller.resources.limits.cpu=1 \
  --set controller.resources.limits.memory=1Gi \
  --wait
```

```yaml
# NodePool definition (formerly Provisioner)
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: general-purpose
spec:
  template:
    metadata:
      labels:
        role: application
    spec:
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand", "spot"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["m", "c", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["4"]
        - key: karpenter.k8s.aws/instance-size
          operator: In
          values: ["large", "xlarge", "2xlarge"]
      nodeClassRef:
        name: default
  limits:
    cpu: "100"
    memory: 400Gi
  disruption:
    consolidationPolicy: WhenUnderutilized
    expireAfter: 720h  # Node rotation after 30 days
---
# EC2NodeClass
apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiFamily: AL2
  role: KarpenterNodeRole-my-cluster
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: my-cluster
        kubernetes.io/role/internal-elb: "1"
  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: my-cluster
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 100Gi
        volumeType: gp3
        iops: 3000
        throughput: 125
        encrypted: true
  metadataOptions:
    httpEndpoint: enabled
    httpProtocolIPv6: disabled
    httpPutResponseHopLimit: 2
    httpTokens: required
  tags:
    Environment: production
```

```
Cluster Autoscaler vs Karpenter:

Cluster Autoscaler:
  ✓ Stable and mature project
  ✓ Simple configuration
  ✗ ASG-based → instance type is fixed
  ✗ Slow scale-out (1-3 minutes)
  ✗ Inefficient bin packing

Karpenter (recommended):
  ✓ No ASG → calls EC2 API directly
  ✓ Fast scale-out (within seconds)
  ✓ Automatically selects optimal instance type for Pod requirements
  ✓ Efficient bin packing and consolidation
  ✓ Automatic Spot interruption handling
  ✗ EKS-specific (not supported for other K8s distributions)
  ✗ Relatively new project
```

### 8.3 Horizontal Pod Autoscaler (HPA)

```yaml
# HPA definition
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    # Custom metrics (via Prometheus Adapter)
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "1000"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
```

### 8.4 KEDA (Kubernetes Event-Driven Autoscaling)

```yaml
# KEDA ScaledObject (SQS queue-based scaling)
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: sqs-consumer-scaler
  namespace: production
spec:
  scaleTargetRef:
    name: sqs-consumer
  pollingInterval: 15
  cooldownPeriod: 60
  minReplicaCount: 1
  maxReplicaCount: 50
  triggers:
    - type: aws-sqs-queue
      authenticationRef:
        name: keda-aws-credentials
      metadata:
        queueURL: https://sqs.ap-northeast-1.amazonaws.com/123456789012/my-queue
        queueLength: "5"    # 1 Pod per 5 messages
        awsRegion: ap-northeast-1
        identityOwner: operator
---
apiVersion: keda.sh/v1alpha1
kind: TriggerAuthentication
metadata:
  name: keda-aws-credentials
  namespace: production
spec:
  podIdentity:
    provider: aws-eks
```

---

## 9. Networking and Security

### 9.1 AWS Load Balancer Controller

```bash
# Install AWS Load Balancer Controller
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  --namespace kube-system \
  --set clusterName=my-cluster \
  --set serviceAccount.create=true \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=arn:aws:iam::123456789012:role/aws-lbc-role
```

```yaml
# Ingress resource (ALB)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: "15"
    alb.ingress.kubernetes.io/healthy-threshold-count: "2"
    alb.ingress.kubernetes.io/unhealthy-threshold-count: "3"
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/my-acl/xxx
    alb.ingress.kubernetes.io/shield-advanced-protection: "true"
    alb.ingress.kubernetes.io/group.name: my-app
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app-svc
                port:
                  number: 80
          - path: /admin
            pathType: Prefix
            backend:
              service:
                name: admin-svc
                port:
                  number: 80
```

### 9.2 Network Policies

```bash
# Install Calico (network policy engine)
helm repo add projectcalico https://docs.projectcalico.org/charts
helm install calico projectcalico/tigera-operator \
  --namespace tigera-operator \
  --create-namespace
```

```yaml
# Default deny policy (deny all traffic within namespace)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# Allow frontend → backend communication
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
---
# Allow backend → database communication
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-backend-to-db
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS resolution
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
```

### 9.3 Pod Security Standards

```yaml
# Pod Security Admission (PSA) configuration
# Apply security standards at the namespace level

# Restricted level (most strict)
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
---
# Baseline level (for development environments)
apiVersion: v1
kind: Namespace
metadata:
  name: development
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/warn: restricted
```

```yaml
# Pod definition compliant with Restricted level
apiVersion: v1
kind: Pod
metadata:
  name: secure-app
  namespace: production
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: app
      image: 123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app:v1.0
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop: ["ALL"]
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache
  volumes:
    - name: tmp
      emptyDir: {}
    - name: cache
      emptyDir: {}
```

### 9.4 Secrets Management

```bash
# Install AWS Secrets Manager CSI Driver
helm repo add secrets-store-csi-driver \
  https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm install csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver \
  --namespace kube-system \
  --set syncSecret.enabled=true

# Install AWS Provider
kubectl apply -f https://raw.githubusercontent.com/aws/secrets-store-csi-driver-provider-aws/main/deployment/aws-provider-installer.yaml
```

```yaml
# SecretProviderClass
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: aws-secrets
  namespace: production
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "prod/my-app/database"
        objectType: "secretsmanager"
        jmesPath:
          - path: username
            objectAlias: db-username
          - path: password
            objectAlias: db-password
      - objectName: "/prod/my-app/api-key"
        objectType: "ssmparameter"
  secretObjects:
    - secretName: db-credentials
      type: Opaque
      data:
        - objectName: db-username
          key: username
        - objectName: db-password
          key: password
---
# Mount Secret in Pod
apiVersion: v1
kind: Pod
metadata:
  name: my-app
  namespace: production
spec:
  serviceAccountName: my-app-sa
  containers:
    - name: app
      image: my-app:v1.0
      env:
        - name: DB_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
      volumeMounts:
        - name: secrets
          mountPath: /mnt/secrets
          readOnly: true
  volumes:
    - name: secrets
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: aws-secrets
```

---

## 10. Observability

### 10.1 Amazon CloudWatch Container Insights

```bash
# Install Container Insights add-on
aws eks create-addon \
  --cluster-name my-cluster \
  --addon-name amazon-cloudwatch-observability \
  --addon-version v1.5.0-eksbuild.1 \
  --service-account-role-arn arn:aws:iam::123456789012:role/cloudwatch-agent-role
```

```yaml
# Advanced CloudWatch Agent configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudwatch-agent-config
  namespace: amazon-cloudwatch
data:
  cwagentconfig.json: |
    {
      "logs": {
        "metrics_collected": {
          "kubernetes": {
            "cluster_name": "my-cluster",
            "metrics_collection_interval": 60
          },
          "app_signals": {
            "enabled": true
          }
        },
        "force_flush_interval": 5
      },
      "traces": {
        "traces_collected": {
          "xray": {
            "tcp_proxy": {
              "bind_address": "0.0.0.0:2000"
            }
          },
          "otlp": {
            "grpc_endpoint": "0.0.0.0:4317",
            "http_endpoint": "0.0.0.0:4318"
          }
        }
      },
      "metrics": {
        "metrics_collected": {
          "prometheus": {
            "cluster_name": "my-cluster",
            "log_group_name": "/aws/containerinsights/my-cluster/prometheus"
          }
        }
      }
    }
```

### 10.2 Prometheus + Grafana

```bash
# Create Amazon Managed Prometheus (AMP) workspace
aws amp create-workspace \
  --alias my-cluster-metrics \
  --tags Environment=production

# Install Prometheus with Helm (AMP remote write)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values prometheus-values.yaml
```

```yaml
# prometheus-values.yaml
prometheus:
  prometheusSpec:
    remoteWrite:
      - url: https://aps-workspaces.ap-northeast-1.amazonaws.com/workspaces/ws-xxxxxxxx/api/v1/remote_write
        sigv4:
          region: ap-northeast-1
        queueConfig:
          maxSamplesPerSend: 1000
          maxShards: 200
          capacity: 2500
    retention: 2h  # Keep local retention short
    resources:
      requests:
        cpu: 500m
        memory: 2Gi
      limits:
        cpu: "2"
        memory: 8Gi
    storageSpec:
      volumeClaimTemplate:
        spec:
          storageClassName: gp3
          resources:
            requests:
              storage: 50Gi
    serviceMonitorSelectorNilUsesHelmValues: false

grafana:
  enabled: true
  adminPassword: "changeme"
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
        - name: AMP
          type: prometheus
          url: https://aps-workspaces.ap-northeast-1.amazonaws.com/workspaces/ws-xxxxxxxx
          jsonData:
            sigV4Auth: true
            sigV4AuthType: default
            sigV4Region: ap-northeast-1

alertmanager:
  config:
    global:
      resolve_timeout: 5m
    route:
      receiver: slack
      group_by: ['alertname', 'namespace']
      group_wait: 30s
      group_interval: 5m
      repeat_interval: 4h
    receivers:
      - name: slack
        slack_configs:
          - api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'
            channel: '#alerts'
            title: '{{ .GroupLabels.alertname }}'
            text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

```yaml
# ServiceMonitor (collect application metrics)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app-monitor
  namespace: production
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
  namespaceSelector:
    matchNames:
      - production
```

### 10.3 AWS Distro for OpenTelemetry (ADOT)

```yaml
# ADOT Collector configuration
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: adot-collector
  namespace: monitoring
spec:
  mode: deployment
  serviceAccount: adot-collector
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318

    processors:
      batch:
        timeout: 30s
        send_batch_size: 8192
      memory_limiter:
        check_interval: 5s
        limit_mib: 1500
        spike_limit_mib: 512

    exporters:
      awsxray:
        region: ap-northeast-1
      awsemf:
        region: ap-northeast-1
        namespace: MyApp
        log_group_name: /aws/containerinsights/my-cluster/application
      prometheusremotewrite:
        endpoint: https://aps-workspaces.ap-northeast-1.amazonaws.com/workspaces/ws-xxx/api/v1/remote_write
        auth:
          authenticator: sigv4auth

    extensions:
      sigv4auth:
        region: ap-northeast-1
        service: aps

    service:
      extensions: [sigv4auth]
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch, memory_limiter]
          exporters: [awsxray]
        metrics:
          receivers: [otlp]
          processors: [batch, memory_limiter]
          exporters: [awsemf, prometheusremotewrite]
```

---

## 11. GitOps

### 11.1 ArgoCD

```bash
# Install ArgoCD
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --set server.service.type=LoadBalancer \
  --set server.extraArgs="{--insecure}" \
  --set configs.params."server\.insecure"=true
```

```yaml
# ArgoCD Application definition
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/my-org/k8s-manifests.git
    targetRevision: main
    path: apps/my-app/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PrunePropagationPolicy=foreground
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:
        - /spec/replicas  # Ignored because managed by HPA
---
# ApplicationSet (manage multiple environments at once)
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: my-app-set
  namespace: argocd
spec:
  generators:
    - list:
        elements:
          - cluster: dev
            url: https://kubernetes.default.svc
            namespace: dev
            values_file: dev
          - cluster: staging
            url: https://kubernetes.default.svc
            namespace: staging
            values_file: staging
          - cluster: production
            url: https://kubernetes.default.svc
            namespace: production
            values_file: production
  template:
    metadata:
      name: 'my-app-{{cluster}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/my-org/k8s-manifests.git
        targetRevision: main
        path: apps/my-app
        helm:
          valueFiles:
            - 'values-{{values_file}}.yaml'
      destination:
        server: '{{url}}'
        namespace: '{{namespace}}'
```

### 11.2 Flux CD

```bash
# Install Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# Bootstrap Flux
flux bootstrap github \
  --owner=my-org \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --personal
```

```yaml
# GitRepository
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/my-org/k8s-manifests
  ref:
    branch: main
  secretRef:
    name: github-token
---
# Kustomization
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 5m
  path: ./apps/my-app/overlays/production
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
  retryInterval: 1m
```

```
ArgoCD vs Flux:

ArgoCD:
  ✓ Rich Web UI
  ✓ Easy multi-cluster management
  ✓ Large-scale management with ApplicationSet
  ✓ Comprehensive RBAC
  ✗ Somewhat higher resource consumption
  ✗ Somewhat higher learning curve

Flux:
  ✓ Lightweight and simple
  ✓ Git-centric design philosophy
  ✓ Built-in Helm Controller
  ✓ CNCF Graduated project
  ✗ Separate Web UI required
  ✗ Multi-cluster management is somewhat complex
```

---

## 12. Cost Optimization

### 12.1 Understanding the Cost Structure

```
EKS Cost Components:

+--------------------------------------------+
| Control Plane: $0.10/hr ($73/mo)            |
+--------------------------------------------+
|                                            |
| Data Plane (majority of cost):             |
| +----------------------------------------+ |
| | EC2 (On-Demand)    $$$$               | |
| | EC2 (Spot)         $$                  | |
| | EC2 (Reserved/SP)  $$$                | |
| | Fargate            $$$                | |
| +----------------------------------------+ |
|                                            |
| Networking:                                |
| +----------------------------------------+ |
| | NAT Gateway        $$                  | |
| | ALB/NLB            $                   | |
| | Data transfer      $                   | |
| +----------------------------------------+ |
|                                            |
| Storage:                                   |
| +----------------------------------------+ |
| | EBS (gp3)          $                   | |
| | EFS                $$                  | |
| +----------------------------------------+ |
|                                            |
| Logging & Monitoring:                      |
| +----------------------------------------+ |
| | CloudWatch Logs    $                   | |
| | Container Insights $                   | |
| +----------------------------------------+ |
+--------------------------------------------+
```

### 12.2 Cost Optimization Best Practices

```yaml
# Leveraging Spot instances (Karpenter)
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: spot-pool
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["m", "c", "r"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["4"]
      nodeClassRef:
        name: default
  disruption:
    consolidationPolicy: WhenUnderutilized
  weight: 80  # Prefer Spot
---
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: on-demand-pool
spec:
  template:
    spec:
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
        - key: karpenter.k8s.aws/instance-category
          operator: In
          values: ["m"]
      nodeClassRef:
        name: default
  weight: 20  # Fallback
```

```yaml
# Rightsizing resource requests/limits
# Use VPA (Vertical Pod Autoscaler) to get recommendations
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-app-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Off"  # First, only check recommendations
  resourcePolicy:
    containerPolicies:
      - containerName: app
        minAllowed:
          cpu: 50m
          memory: 64Mi
        maxAllowed:
          cpu: "2"
          memory: 4Gi
```

```bash
# Check VPA recommendations
kubectl describe vpa my-app-vpa -n production

# Install Kubecost (cost visualization)
helm repo add kubecost https://kubecost.github.io/cost-analyzer/
helm install kubecost kubecost/cost-analyzer \
  --namespace kubecost \
  --create-namespace \
  --set kubecostToken="xxxxx"
```

---

## 13. Anti-Patterns

### 13.1 Granting Broad Permissions to Node IAM Roles

```
[Bad example]
Node role --> AdministratorAccess
  → All Pods have admin privileges

[Good example]
Node role --> Minimal (EKS Worker Policy, CNI Policy, ECR ReadOnly)
Pod level --> Grant individual permissions with IRSA
  → Each Pod has only the minimum required permissions
```

**Problem**: Granting broad permissions to the node IAM role allows all Pods on that node to use those permissions.

**Improvement**: Use IRSA or EKS Pod Identity to grant minimum permissions per Pod/ServiceAccount.

### 13.2 Manually Managing EKS Add-ons

**Problem**: Manually installing and updating critical components like CoreDNS, kube-proxy, and VPC CNI leads to version inconsistencies and delayed security patches.

**Improvement**: Use EKS managed add-ons and leverage AWS-recommended automatic version updates.

### 13.3 Not Setting Resource Requests/Limits

```
[Bad example]
containers:
  - name: app
    image: my-app:v1
    # resources not set
    # → Consumes node resources without limit
    # → Causes OOMKill and CPU throttling

[Good example]
containers:
  - name: app
    image: my-app:v1
    resources:
      requests:
        cpu: 250m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
    # → Scheduler allocates resources appropriately
    # → HPA/VPA functions correctly
```

### 13.4 Not Setting PodDisruptionBudget

```yaml
# Without PDB, all Pods may stop simultaneously during node updates

# Recommended: Configure PDB
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: my-app-pdb
  namespace: production
spec:
  minAvailable: 2
  # or maxUnavailable: 1
  selector:
    matchLabels:
      app: my-app
```

### 13.5 Deploying to a Single AZ

```yaml
# Enforce AZ distribution with Pod Anti-Affinity
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: my-app
```

---

## 14. CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'CloudFormation template for EKS cluster'

Parameters:
  ClusterName:
    Type: String
    Default: my-cluster

  KubernetesVersion:
    Type: String
    Default: "1.29"

  NodeGroupInstanceType:
    Type: String
    Default: m5.large

  NodeGroupDesiredSize:
    Type: Number
    Default: 3

  NodeGroupMinSize:
    Type: Number
    Default: 2

  NodeGroupMaxSize:
    Type: Number
    Default: 10

Resources:
  # EKS cluster role
  EKSClusterRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '${ClusterName}-cluster-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: eks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEKSClusterPolicy
        - arn:aws:iam::aws:policy/AmazonEKSVPCResourceController

  # Node role
  EKSNodeRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub '${ClusterName}-node-role'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

  # EKS cluster
  EKSCluster:
    Type: AWS::EKS::Cluster
    Properties:
      Name: !Ref ClusterName
      Version: !Ref KubernetesVersion
      RoleArn: !GetAtt EKSClusterRole.Arn
      ResourcesVpcConfig:
        SubnetIds:
          - !ImportValue 'network-PrivateSubnet1Id'
          - !ImportValue 'network-PrivateSubnet2Id'
          - !ImportValue 'network-PublicSubnet1Id'
          - !ImportValue 'network-PublicSubnet2Id'
        SecurityGroupIds:
          - !Ref ClusterSecurityGroup
        EndpointPublicAccess: true
        EndpointPrivateAccess: true
      Logging:
        ClusterLogging:
          EnabledTypes:
            - Type: api
            - Type: audit
            - Type: authenticator
            - Type: controllerManager
            - Type: scheduler

  # Cluster security group
  ClusterSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: EKS Cluster Security Group
      VpcId: !ImportValue 'network-VpcId'
      Tags:
        - Key: Name
          Value: !Sub '${ClusterName}-cluster-sg'

  # Managed node group
  EKSNodeGroup:
    Type: AWS::EKS::Nodegroup
    DependsOn: EKSCluster
    Properties:
      ClusterName: !Ref ClusterName
      NodegroupName: !Sub '${ClusterName}-general-ng'
      NodeRole: !GetAtt EKSNodeRole.Arn
      Subnets:
        - !ImportValue 'network-PrivateSubnet1Id'
        - !ImportValue 'network-PrivateSubnet2Id'
      InstanceTypes:
        - !Ref NodeGroupInstanceType
      ScalingConfig:
        DesiredSize: !Ref NodeGroupDesiredSize
        MinSize: !Ref NodeGroupMinSize
        MaxSize: !Ref NodeGroupMaxSize
      DiskSize: 100
      CapacityType: ON_DEMAND
      Labels:
        role: general
      Tags:
        Environment: production

  # OIDC provider (for IRSA)
  OIDCProvider:
    Type: AWS::IAM::OIDCProvider
    DependsOn: EKSCluster
    Properties:
      Url: !GetAtt EKSCluster.OpenIdConnectIssuerUrl
      ClientIdList:
        - sts.amazonaws.com
      ThumbprintList:
        - "9e99a48a9960b14926bb7f3b02e22da2b0ab7280"

Outputs:
  ClusterName:
    Value: !Ref EKSCluster
    Export:
      Name: !Sub '${ClusterName}-ClusterName'

  ClusterEndpoint:
    Value: !GetAtt EKSCluster.Endpoint
    Export:
      Name: !Sub '${ClusterName}-ClusterEndpoint'

  ClusterArn:
    Value: !GetAtt EKSCluster.Arn

  OIDCProviderArn:
    Value: !GetAtt OIDCProvider.Arn
    Export:
      Name: !Sub '${ClusterName}-OIDCProviderArn'
```

---

## 15. FAQ

### Q1. Which should I choose: EKS or ECS?

EKS is appropriate when you have Kubernetes experience, a multi-cloud/hybrid cloud strategy, or want to leverage the CNCF ecosystem (Istio, ArgoCD, etc.). ECS is appropriate for simple container workloads centered on AWS, small teams, or when you want to minimize operational overhead.

### Q2. How should EKS version upgrades be performed?

EKS has a limited Kubernetes version support period (approximately 14 months). Upgrade the control plane with `aws eks update-cluster-version`, then update the managed node groups. Verify add-on compatibility and application compatibility testing in advance, validate in a staging environment, and then apply to production.

### Q3. How much does EKS cost?

The control plane fee is $0.10/hr ($73/mo). In addition, data plane costs (EC2 instances or Fargate) apply. Since data plane costs are greater than EKS itself, proper node sizing and Spot instance utilization are key to cost optimization.

### Q4. Which should I use: Cluster Autoscaler or Karpenter?

For new clusters, Karpenter is recommended. Since Karpenter calls the EC2 API directly without using ASG, it enables flexible instance type selection, fast scale-out, and efficient bin packing. For existing ASG-based operations, a practical strategy is to continue using Cluster Autoscaler while gradually migrating to Karpenter.

### Q5. Which should I use: IRSA or EKS Pod Identity?

For new setups, EKS Pod Identity is recommended. No OIDC provider configuration is required, and the IAM role trust policy becomes simpler. However, since it does not support Fargate Pods, continue using IRSA when using Fargate. There is little need to migrate existing IRSA configurations; a reasonable approach is to start using Pod Identity for new ServiceAccounts.

### Q6. What are the best practices for multiple teams sharing an EKS cluster?

Combine logical isolation with Namespaces, permission control with RBAC, resource limits with ResourceQuota, network isolation with NetworkPolicy, and application of security standards with Pod Security Standards. For large organizations, separating clusters per team and using GitOps tools (ArgoCD ApplicationSet) for unified management is also effective.

### Q7. How do I run GPU workloads on EKS?

Create a GPU node group (p3, p4, g4dn, g5 instances) and install the NVIDIA Device Plugin. Using the EKS-optimized GPU AMI eliminates the need to install drivers. Request GPU resources as `nvidia.com/gpu`, and use Taint/Toleration to ensure only dedicated Pods are scheduled on GPU nodes. With Karpenter, on-demand provisioning of GPU instances can also be automated.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not only through theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and moving on to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| EKS Architecture | Control plane (AWS managed) + Data plane (user managed) |
| Node Groups | Choose from managed (recommended), self-managed, or Fargate |
| Fargate Profiles | Serverless execution of Pods matching namespace + labels |
| Helm | Kubernetes package manager. Manage applications with Charts |
| IRSA / Pod Identity | Assign IAM roles per Pod. Essential for least privilege |
| EKS Add-ons | Manage vpc-cni, coredns, kube-proxy, etc. as managed add-ons |
| Auto Scaling | Karpenter recommended. Scale at the Pod level with HPA/KEDA |
| Security | Multi-layered defense with PSA, NetworkPolicy, Secrets CSI Driver |
| Observability | Integrated monitoring with Container Insights, Prometheus/Grafana, ADOT |
| GitOps | Declarative deployment management with ArgoCD / Flux |
| Cost Optimization | Continuously optimize with Spot + Karpenter, VPA, Kubecost |

---

## Further Reading

- [ECS Basics](./00-ecs-basics.md) -- For comparison with ECS
- [ECR](./01-ecr.md) -- Container image management
- [IAM Deep Dive](../08-security/00-iam-deep-dive.md) -- Deepen IAM design for IRSA
- [CloudFormation](../07-devops/00-cloudformation.md) -- IaC management for EKS clusters

---

## References

1. AWS Official Documentation "Amazon EKS User Guide" https://docs.aws.amazon.com/eks/latest/userguide/
2. AWS Official "Amazon EKS Best Practices Guide" https://aws.github.io/aws-eks-best-practices/
3. eksctl Official Documentation https://eksctl.io/
4. Helm Official Documentation https://helm.sh/docs/
5. Karpenter Official Documentation https://karpenter.sh/docs/
6. ArgoCD Official Documentation https://argo-cd.readthedocs.io/
7. Flux CD Official Documentation https://fluxcd.io/docs/
8. AWS Official "EKS Pod Identity" https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html
