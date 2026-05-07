# Deployment Strategies

> Systematically understand major deployment strategies including Blue-Green, Canary, Rolling, and Feature Flags to achieve safe and fast releases

## What You Will Learn

1. **How major deployment strategies work and when to use them** — Operating principles and applicable conditions for Blue-Green, Canary, Rolling Update, and Recreate
2. **Release control with Feature Flags** — Techniques to separate code deployment from release and achieve phased rollout
3. **Rollback design and risk mitigation** — Mechanisms and operational processes for immediate recovery when failures occur
4. **DB migration strategies** — Safe execution of database schema changes coordinated with deployments
5. **Designing automated deployment pipelines** — Building CI/CD pipelines integrated with GitHub Actions


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Overview of Deployment Strategies

```
┌─────────────────────────────────────────────────────┐
│              Deployment Strategy Classification       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐    │
│  │ Recreate  │   │  Rolling  │   │ Blue-Green│    │
│  │ (Full     │   │ (Staged   │   │ (Env      │    │
│  │  Stop)    │   │  Replace) │   │  Switch)  │    │
│  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘    │
│        │               │               │           │
│        ▼               ▼               ▼           │
│  Has Downtime    Zero Downtime    Zero Downtime    │
│  Simplest        Resource-        Instant          │
│                  Efficient        Rollback         │
│                                                     │
│  ┌───────────┐   ┌───────────┐                     │
│  │  Canary   │   │  A/B Test │                     │
│  │ (Staged   │   │ (Compare  │                     │
│  │  Release) │   │  & Verify)│                     │
│  └─────┬─────┘   └─────┬─────┘                     │
│        │               │                           │
│        ▼               ▼                           │
│  Minimize Risk    Data-Driven Decisions            │
└─────────────────────────────────────────────────────┘
```

### 1.1 Selection Criteria Matrix

```
Decision flow when choosing a deployment strategy:

  Is downtime acceptable?
       │
  ┌────┴────┐
  │ Yes     │ No
  │         │
  ↓         ├── Minimize resource cost?
  Recreate  │         │
            │    ┌────┴────┐
            │    │ Yes     │ No
            │    │         │
            │    ↓         ├── Need staged risk validation?
            │    Rolling   │         │
            │              │    ┌────┴────┐
            │              │    │ Yes     │ No
            │              │    │         │
            │              │    ↓         ↓
            │              │    Canary    Blue-Green
            │              │
            │              └── Need A/B testing? → A/B Test
            │
            └── Control releases with Feature Flag? → Feature Flag
```

---

## 2. Recreate Deployment

The simplest strategy: stop all instances, then start the new version.

```
Recreate deployment flow:

Time axis ──────────────────────────────────────────►

Step 1: Old version is running
  [v1] [v1] [v1] ◄── All traffic

Step 2: Stop all instances (downtime begins)
  [---] [---] [---]  ← Service stopped

Step 3: Start new version (downtime ends)
  [v2] [v2] [v2] ◄── All traffic
```

```yaml
# Kubernetes Recreate deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  strategy:
    type: Recreate  # Stop all Pods, then start new Pods
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
          ports:
            - containerPort: 3000
```

```
When Recreate is appropriate:
  - Development/staging environments
  - Batch processing servers
  - Deployments involving destructive DB schema changes
  - Cases where old and new versions cannot coexist
  - Cases with strict cost constraints and no additional resources available
```

---

## 3. Blue-Green Deployment

A strategy that prepares two identical environments (Blue/Green) and switches all traffic at once.

```yaml
# docker-compose.blue-green.yml
version: "3.8"

services:
  app-blue:
    image: myapp:v1.0.0
    ports:
      - "8081:3000"
    environment:
      - ENV=production
      - SLOT=blue

  app-green:
    image: myapp:v1.1.0
    ports:
      - "8082:3000"
    environment:
      - ENV=production
      - SLOT=green

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app-blue
      - app-green
```

```nginx
# nginx.conf — Blue-Green switching
upstream active_backend {
    # Specify the currently active slot
    # Change this when switching from Blue → Green
    server app-green:3000;
}

upstream standby_backend {
    server app-blue:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://active_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # For health checks
    location /health {
        proxy_pass http://active_backend/health;
    }
}
```

```
Blue-Green deployment flow:

Time axis ──────────────────────────────────────────►

Step 1: Blue (v1) is running
  [Blue v1] ◄── All traffic
  [Green   ] (standby)

Step 2: Deploy v2 to Green
  [Blue v1] ◄── All traffic
  [Green v2] (starting up, being tested)

Step 3: Switch after health check passes
  [Blue v1 ] (standby = rollback target)
  [Green v2] ◄── All traffic

Step 4: Release Blue if no issues
  [Blue    ] (released or for next version)
  [Green v2] ◄── All traffic
```

### 3.1 Blue-Green with AWS ALB

```yaml
# Blue-Green deployment with GitHub Actions
name: Blue-Green Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Determine target group
        id: target
        run: |
          # Get the currently active target group
          ACTIVE_TG=$(aws elbv2 describe-rules \
            --listener-arn ${{ secrets.ALB_LISTENER_ARN }} \
            --query 'Rules[0].Actions[0].TargetGroupArn' --output text)

          if echo "$ACTIVE_TG" | grep -q "blue"; then
            echo "deploy_tg=green" >> "$GITHUB_OUTPUT"
            echo "active_tg=blue" >> "$GITHUB_OUTPUT"
          else
            echo "deploy_tg=blue" >> "$GITHUB_OUTPUT"
            echo "active_tg=green" >> "$GITHUB_OUTPUT"
          fi

      - name: Deploy to standby environment
        run: |
          # Deploy to the standby environment
          aws ecs update-service \
            --cluster production \
            --service myapp-${{ steps.target.outputs.deploy_tg }} \
            --task-definition myapp:latest \
            --force-new-deployment

          # Wait until the service is stable
          aws ecs wait services-stable \
            --cluster production \
            --services myapp-${{ steps.target.outputs.deploy_tg }}

      - name: Health check on standby
        run: |
          HEALTH_URL="https://${{ steps.target.outputs.deploy_tg }}.internal.example.com/health"
          for i in $(seq 1 10); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed"
              exit 0
            fi
            echo "Attempt $i/10: Status $STATUS"
            sleep 5
          done
          echo "Health check failed"
          exit 1

      - name: Switch traffic
        run: |
          # Update ALB listener rule to switch traffic
          aws elbv2 modify-rule \
            --rule-arn ${{ secrets.ALB_RULE_ARN }} \
            --actions Type=forward,TargetGroupArn=${{ secrets[format('TG_{0}_ARN', steps.target.outputs.deploy_tg)] }}

          echo "Traffic switched to ${{ steps.target.outputs.deploy_tg }}"

      - name: Verify deployment
        run: |
          sleep 30  # Wait for DNS propagation
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.example.com/health)
          if [ "$STATUS" != "200" ]; then
            echo "::error::Deployment verification failed! Rolling back..."
            # Rollback: revert to the original target group
            aws elbv2 modify-rule \
              --rule-arn ${{ secrets.ALB_RULE_ARN }} \
              --actions Type=forward,TargetGroupArn=${{ secrets[format('TG_{0}_ARN', steps.target.outputs.active_tg)] }}
            exit 1
          fi
          echo "Deployment verified successfully"
```

---

## 4. Canary Deployment

Gradually increase traffic to the new version in small increments, expanding to the full user base while confirming there are no issues.

```yaml
# Kubernetes - Canary deployment (Ingress-based)
# stable deployment (v1)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
  labels:
    app: myapp
    version: stable
spec:
  replicas: 9
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
    spec:
      containers:
        - name: myapp
          image: myapp:v1.0.0
          ports:
            - containerPort: 3000
---
# canary deployment (v2)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
  labels:
    app: myapp
    version: canary
spec:
  replicas: 1  # 1 out of 10 total = 10%
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
          ports:
            - containerPort: 3000
---
# Common Service (routes to both)
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp  # Do not specify version label
  ports:
    - port: 80
      targetPort: 3000
```

### 4.1 Advanced Canary Deployment with Istio

```yaml
# Control traffic ratio with Istio VirtualService
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: myapp
spec:
  hosts:
    - myapp.example.com
  http:
    - route:
        - destination:
            host: myapp-stable
            port:
              number: 3000
          weight: 90
        - destination:
            host: myapp-canary
            port:
              number: 3000
          weight: 10
```

### 4.2 Canary with AWS App Mesh

```yaml
# Split canary traffic with AWS App Mesh Route
apiVersion: appmesh.k8s.aws/v1beta2
kind: VirtualRouter
metadata:
  name: myapp-router
spec:
  listeners:
    - portMapping:
        port: 3000
        protocol: http
  routes:
    - name: canary-route
      httpRoute:
        match:
          prefix: /
        action:
          weightedTargets:
            - virtualNodeRef:
                name: myapp-stable
              weight: 90
            - virtualNodeRef:
                name: myapp-canary
              weight: 10
```

### 4.3 Canary Phased Rollout Script

```bash
#!/bin/bash
# canary-rollout.sh — Canary phased rollout
set -euo pipefail

STAGES=(5 10 25 50 75 100)  # Traffic ratio (%)
OBSERVATION_TIME=300          # Observation time per stage (seconds)
ERROR_THRESHOLD=5             # Error rate threshold (%)

for WEIGHT in "${STAGES[@]}"; do
  echo "=== Stage: ${WEIGHT}% canary traffic ==="

  # Update traffic ratio
  kubectl patch virtualservice myapp --type=json \
    -p="[{\"op\":\"replace\",\"path\":\"/spec/http/0/route/1/weight\",\"value\":${WEIGHT}},
         {\"op\":\"replace\",\"path\":\"/spec/http/0/route/0/weight\",\"value\":$((100-WEIGHT))}]"

  echo "Observing for ${OBSERVATION_TIME}s..."
  sleep "${OBSERVATION_TIME}"

  # Get metrics and check error rate
  ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{version=\"canary\",code=~\"5..\"}[5m])/rate(http_requests_total{version=\"canary\"}[5m])*100" \
    | jq -r '.data.result[0].value[1] // "0"')

  echo "Current error rate: ${ERROR_RATE}%"

  if (( $(echo "${ERROR_RATE} > ${ERROR_THRESHOLD}" | bc -l) )); then
    echo "::error::Error rate ${ERROR_RATE}% exceeds threshold ${ERROR_THRESHOLD}%. Rolling back!"
    kubectl patch virtualservice myapp --type=json \
      -p='[{"op":"replace","path":"/spec/http/0/route/1/weight","value":0},
           {"op":"replace","path":"/spec/http/0/route/0/weight","value":100}]'
    exit 1
  fi

  if [ "${WEIGHT}" -eq 100 ]; then
    echo "Canary rollout complete! Scaling down stable version."
    kubectl scale deployment myapp-stable --replicas=0
    kubectl scale deployment myapp-canary --replicas=10
  fi
done
```

---

## 5. Rolling Update

Gradually replace existing instances with the new version. This is the default strategy for Kubernetes.

```yaml
# Kubernetes Rolling Update configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2        # Number of Pods that can be added at once
      maxUnavailable: 1  # Number of Pods that can be stopped simultaneously
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

```
Rolling Update flow (replicas=6, maxSurge=2, maxUnavailable=1):

Step 1: Initial state
  [v1] [v1] [v1] [v1] [v1] [v1]  (6 running)

Step 2: Add new Pods, stop 1 old Pod
  [v1] [v1] [v1] [v1] [v1] [--] [v2] [v2]  (5 running + 2 starting)

Step 3: Once v2 is Ready, replace the next old Pod
  [v1] [v1] [v1] [v1] [--] [v2] [v2] [v2]  (6 running + 1 starting)

Step 4: Repeat
  [v1] [v1] [v1] [--] [v2] [v2] [v2] [v2]

Step 5: Complete
  [v2] [v2] [v2] [v2] [v2] [v2]  (all 6 are v2)
```

### 5.1 Rolling Update Parameter Tuning

```
maxSurge and maxUnavailable configuration guide:

Fast deployment (when resources are available):
  maxSurge: 50%
  maxUnavailable: 25%
  → Uses up to 150% of total resources
  → One quarter stopped at once

Safety-first deployment (production):
  maxSurge: 1
  maxUnavailable: 0
  → Always keeps at least the replica count of Pods running
  → Replaces one at a time carefully

Balanced (recommended):
  maxSurge: 25%
  maxUnavailable: 25%
  → Kubernetes default
  → Appropriate for most cases
```

---

## 6. Release Control with Feature Flags

### 6.1 The Feature Flag Concept

```
Core concept of Feature Flags:

  Deploy ≠ Release

  Traditional approach:
    Code deployment = Publishing to users
    → Deployment failure = Service outage

  Feature Flags:
    Code deployed → Flag OFF (invisible to users)
    Validation complete → Flag ON (gradually published)
    Issue found → Flag OFF (instant recovery)
    → Deployment and release are decoupled
```

### 6.2 Feature Flag Implementation

```typescript
// feature-flag.ts — Simple Feature Flag implementation
interface FeatureFlag {
  name: string;
  enabled: boolean;
  rolloutPercentage: number;  // 0-100
  allowedUsers?: string[];
  metadata?: Record<string, unknown>;
}

class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();

  constructor(private readonly configSource: FlagConfigSource) {}

  async initialize(): Promise<void> {
    const config = await this.configSource.fetch();
    for (const flag of config.flags) {
      this.flags.set(flag.name, flag);
    }
  }

  isEnabled(flagName: string, userId?: string): boolean {
    const flag = this.flags.get(flagName);
    if (!flag) return false;
    if (!flag.enabled) return false;

    // If allowed for specific users
    if (userId && flag.allowedUsers?.includes(userId)) {
      return true;
    }

    // Percentage rollout
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(userId ?? 'anonymous');
      return (hash % 100) < flag.rolloutPercentage;
    }

    return true;
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Usage example
const featureFlags = new FeatureFlagService(remoteConfigSource);
await featureFlags.initialize();

if (featureFlags.isEnabled('new-checkout-flow', currentUser.id)) {
  renderNewCheckout();
} else {
  renderLegacyCheckout();
}
```

### 6.3 Feature Flag Lifecycle Management

```typescript
// feature-flag-lifecycle.ts — Flag lifecycle management
interface FlagLifecycle {
  name: string;
  createdAt: Date;
  createdBy: string;
  status: 'development' | 'testing' | 'rollout' | 'fully-rolled-out' | 'cleanup';
  expiresAt?: Date;  // Expiry date (past this date, it is a candidate for deletion)
  jiraTicket?: string;  // Related ticket
}

class FlagLifecycleManager {
  // Detect expired Flags
  findExpiredFlags(flags: FlagLifecycle[]): FlagLifecycle[] {
    const now = new Date();
    return flags.filter(flag =>
      flag.expiresAt && flag.expiresAt < now &&
      flag.status === 'fully-rolled-out'
    );
  }

  // Generate Flag audit report
  generateAuditReport(flags: FlagLifecycle[]): string {
    const lines = [
      '# Feature Flag Audit Report',
      `Generated: ${new Date().toISOString()}`,
      '',
      '| Flag | Status | Created | Expires | Owner |',
      '|------|--------|---------|---------|-------|',
    ];

    for (const flag of flags) {
      const isExpired = flag.expiresAt && flag.expiresAt < new Date();
      lines.push(
        `| ${flag.name} | ${flag.status} ${isExpired ? '(EXPIRED!)' : ''} | ${flag.createdAt.toISOString().slice(0, 10)} | ${flag.expiresAt?.toISOString().slice(0, 10) ?? '-'} | ${flag.createdBy} |`
      );
    }

    return lines.join('\n');
  }
}
```

### 6.4 Feature Flag Integration with GitHub Actions

```yaml
# Validate Feature Flag state in CI
name: Feature Flag Audit
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check for stale feature flags
        run: |
          # Search for Feature Flag references in code
          echo "## Feature Flag Usage" > flag-report.md

          # Search for isEnabled('flag-name') patterns
          grep -rn "isEnabled\|featureFlag\|FEATURE_" src/ --include="*.ts" --include="*.tsx" | \
            grep -oP "(?:isEnabled|featureFlag)\('\"" | \
            sort -u > found-flags.txt

          echo "Detected Flags:" >> flag-report.md
          cat found-flags.txt >> flag-report.md

      - name: Create issue if stale flags found
        if: steps.check.outputs.stale_count > 0
        uses: peter-evans/create-issue-from-file@v5
        with:
          title: "Feature Flag Audit: Stale flags detected"
          content-filepath: flag-report.md
          labels: tech-debt,feature-flags
```

---

## 7. DB Migration Strategies

### 7.1 Expand and Contract Pattern

```
Three phases of the Expand and Contract pattern:

Phase 1: Expand
  - Add new columns/tables
  - Old code continues to work as-is
  - New code handles both old and new

  ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
  -- Existing rows get false set
  -- Old code is not affected since it doesn't reference email_verified

Phase 2: Migrate
  - Confirm all instances are on the new version
  - Execute data migration
  - Update code to reference only the new column

  UPDATE users SET email_verified = true WHERE verified_at IS NOT NULL;
  -- Migrate data via batch processing

Phase 3: Contract
  - Delete old columns/tables
  - Remove unnecessary code

  ALTER TABLE users DROP COLUMN verified_at;
  -- Safely delete the old column
```

### 7.2 Rules for Safe Migrations

```
Safe migration operations:
  ✅ Adding a column (with default value)
  ✅ Adding a table
  ✅ Adding an index (CONCURRENTLY)
  ✅ Making a column nullable

Dangerous migration operations:
  ❌ Dropping a column (old version may still reference it)
  ❌ Changing a column type
  ❌ Renaming a column
  ❌ Adding NOT NULL constraint (existing data may violate it)
  ❌ Dropping a table

Safe ways to execute dangerous operations:
  Dropping a column:
    1. Remove column references from code and deploy
    2. Confirm all instances are on the new version
    3. Drop the column

  Renaming a column:
    1. Add the new column
    2. Deploy code that writes to both old and new columns
    3. Migrate data to the new column
    4. Remove old column references and deploy
    5. Drop the old column
```

### 7.3 Migrations with GitHub Actions

```yaml
# Automated migration workflow
name: DB Migration
on:
  push:
    branches: [main]
    paths:
      - 'migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ap-northeast-1

      - name: Run migration (dry-run)
        run: |
          # First verify with a dry run
          npx prisma migrate diff \
            --from-schema-datasource prisma/schema.prisma \
            --to-migrations migrations/ \
            --shadow-database-url "$SHADOW_DB_URL"
        env:
          SHADOW_DB_URL: ${{ secrets.SHADOW_DATABASE_URL }}

      - name: Apply migration
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Verify migration
        run: |
          # Schema validation after migration
          npx prisma validate
```

---

## 8. Automated Rollback

### 8.1 Metrics-Based Automated Rollback

```yaml
# AWS Lambda + SAM automated rollback
Resources:
  ApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/lambda.handler
      Runtime: nodejs20.x
      AutoPublishAlias: live
      DeploymentPreference:
        Type: Canary10Percent5Minutes
        Alarms:
          - !Ref ApiErrorAlarm
          - !Ref ApiLatencyAlarm

  # Error rate alarm
  ApiErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      MetricName: 5XXError
      Namespace: AWS/ApiGateway
      Statistic: Sum
      Period: 60
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching

  # Latency alarm
  ApiLatencyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      MetricName: Latency
      Namespace: AWS/ApiGateway
      ExtendedStatistic: p99
      Period: 60
      EvaluationPeriods: 2
      Threshold: 3000  # 3 seconds
      ComparisonOperator: GreaterThanThreshold
```

### 8.2 Kubernetes Automated Rollback

```yaml
# Automated rollback with Argo Rollouts
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: myapp
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 50
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: success-rate
        - setWeight: 100
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:v2.0.0
---
# Analysis template
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
    - name: success-rate
      interval: 30s
      count: 5
      successCondition: result[0] >= 0.95
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            sum(rate(http_requests_total{app="myapp",version="canary",code!~"5.."}[5m]))
            /
            sum(rate(http_requests_total{app="myapp",version="canary"}[5m]))
```

---

## 9. Deployment Strategy Comparison Table

| Characteristic | Recreate | Rolling | Blue-Green | Canary |
|----------------|----------|---------|------------|--------|
| Downtime | Yes | No | No | No |
| Rollback Speed | Slow (redeploy) | Medium (staged) | Instant (switch) | Instant (traffic change) |
| Resource Cost | Low | Medium | High (2x) | Medium-High |
| Risk | High | Medium | Low | Lowest |
| Complexity | Minimal | Low | Medium | High |
| DB Migration | Easy | Requires care | Requires care | Requires care |
| Scale | Small | Medium-Large | Medium-Large | Large |
| Testability | Low | Medium | High (verify on standby) | High (verify with small traffic) |
| Automation Difficulty | Low | Low | Medium | High |

| Feature Flag Comparison | Custom Implementation | LaunchDarkly | Unleash (OSS) | AWS AppConfig |
|-------------------------|----------------------|-------------|---------------|---------------|
| Adoption Cost | Low | High | Medium | Medium |
| Operational Burden | High | Low | Medium | Low |
| Real-Time Updates | Requires implementation | Supported | Supported | Supported |
| Targeting | Requires implementation | Advanced | Intermediate | Basic |
| Audit Logs | Requires implementation | Supported | Supported | Supported |
| Self-Hosted | Possible | No | Possible | No |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Big Bang Deployment

```
[Bad example] Deploy all changes at once

- Release 3 months of changes all at once
- Large gap between test and production environments
- Hard to identify which change caused the issue when problems occur
- Rolling back reverts all features

[Good example] Deploy small and frequently

- Deploy one feature at a time, protected by Feature Flags
- Gradually roll out (1% → 10% → 50% → 100%)
- Easy to isolate issues
- Instant recovery by turning off just that Flag
```

### Anti-Pattern 2: No Rollback Procedures

```
[Bad example]
- Deployment procedures exist but rollback procedures do not
- Frantically investigate how to roll back after an incident
- DB migration rollback is impossible
- Night releases with no one on call

[Good example]
- Document rollback procedures for every deployment
- Set automated rollback thresholds (auto-recover when error rate > 5%)
- Maintain forward compatibility in DB migrations (add column → change code → drop column)
- Practice rollback drills regularly
```

### Anti-Pattern 3: Neglected Feature Flags

```
[Bad example]
- 100% rolled-out Flags remain in the codebase indefinitely
- Complex entangled branches from old Flags make maintenance difficult
- Nobody knows the ON/OFF state of Flags

[Good example]
- Manage Flag lifecycle (creation date, expiry date)
- After 100% rollout, file a tech debt ticket and delete the Flag
- Conduct monthly Flag audits
```

### Anti-Pattern 4: Inadequate Health Checks

```
[Bad example]
- Health check endpoint always returns 200
- Health check succeeds even when DB connection is lost
- Health check intervals are too long, making anomaly detection slow

[Good example]
- Verify actual dependencies (DB, external APIs) in health checks
- Properly separate Readiness Probe and Liveness Probe
- Provide both shallow (/health) and deep (/health/deep) health checks
```

```typescript
// health-check.ts — Proper health check implementation
app.get('/health', (req, res) => {
  // Shallow health check: is the application running?
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/health/deep', async (req, res) => {
  // Deep health check: are the dependencies healthy?
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    externalApi: await checkExternalApi(),
  };

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also create test code

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
        assert False, "Exception should have been raised"
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

**Key Points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Missing or incorrect configuration file | Check the configuration file path and format |
| Timeout | Network latency / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increasing data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check execution user permissions, review configuration |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Steps

1. **Check error messages**: Read the stack trace and identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Validate step by step**: Use log output and debuggers to validate hypotheses
5. **Fix and regression test**: After fixing, also run tests for related areas

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
        logger.debug(f"Calling: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return value: {func.__name__} -> {result}")
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

Steps to diagnose performance issues when they occur:

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check for I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Problem Type | Diagnostic Tool | Solution |
|--------------|----------------|---------|
| CPU load | cProfile, py-spy | Algorithm improvements, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criterion | Prioritize When | Can Compromise When |
|-----------|----------------|---------------------|
| Performance | Real-time processing, large-scale data | Admin dashboards, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development Speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│              Architecture Selection Flow         │
├─────────────────────────────────────────────────┤
│                                                 │
│  ① What is the team size?                       │
│    ├─ Small (1-5 people) → Monolith             │
│    └─ Large (10+ people) → go to ②              │
│                                                 │
│  ② How frequent are deployments?                │
│    ├─ Once a week or less → Monolith + modules  │
│    └─ Daily/multiple times → go to ③            │
│                                                 │
│  ③ How independent are the teams?               │
│    ├─ High → Microservices                      │
│    └─ Moderate → Modular Monolith               │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- A quick short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can cause project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows for the right tool for the job, but increases operational costs

**3. Level of Abstraction**
- High abstraction increases reusability but can make debugging harder
- Low abstraction is intuitive but prone to code duplication

```python
# Architecture decision record template
class ArchitectureDecisionRecord:
    """Creating an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and issues"""
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
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
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
- Focus on minimum viable features
- Automated tests only for critical paths
- Introduce monitoring early

**Lessons Learned:**
- Don't over-engineer (YAGNI principle)
- Get user feedback early
- Manage technical debt consciously

### Scenario 2: Legacy System Modernization

**Situation:** Gradually modernize a system that has been running for over 10 years

**Approach:**
- Use the Strangler Fig pattern for gradual migration
- Create Characterization Tests first when no existing tests exist
- Coexist old and new systems via API gateway
- Execute data migration incrementally

| Phase | Work | Estimated Duration | Risk |
|-------|------|--------------------|------|
| 1. Assessment | Current analysis, understand dependencies | 2-4 weeks | Low |
| 2. Foundation | CI/CD setup, test environment | 4-6 weeks | Low |
| 3. Begin Migration | Migrate peripheral features gradually | 3-6 months | Medium |
| 4. Core Migration | Migrate core functionality | 6-12 months | High |
| 5. Completion | Decommission the old system | 2-4 weeks | Medium |

### Scenario 3: Development with a Large Team

**Situation:** 50+ engineers developing the same product

**Approach:**
- Clarify boundaries with Domain-Driven Design
- Set ownership per team
- Manage shared libraries with Inner Source approach
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

**Situation:** Systems requiring millisecond-level response times

**Optimization Points:**
1. Caching strategy (L1: in-memory, L2: Redis, L3: CDN)
2. Leveraging asynchronous processing
3. Connection pooling
4. Query optimization and index design

| Optimization Technique | Effect | Implementation Cost | Use Case |
|------------------------|--------|---------------------|----------|
| In-memory cache | High | Low | Frequently accessed data |
| CDN | High | Low | Static content |
| Async processing | Medium | Medium | I/O-heavy processing |
| DB optimization | High | High | When queries are slow |
| Code optimization | Low-Medium | High | When CPU-bound |
---

## 11. FAQ

### Q1: Should I choose Blue-Green or Canary?

Decide based on traffic volume and risk tolerance. Blue-Green is appropriate when traffic is low or when a rapid full switchover is needed. Canary is effective for large-scale services where you want to reduce risk incrementally. Also note that Blue-Green doubles infrastructure costs, so consider cost constraints as well.

### Q2: What should I be careful about when deploying with DB migrations?

Use the **Expand and Contract pattern**: (1) add new columns/tables (Expand), (2) make the code compatible with both old and new simultaneously, (3) after all instances have switched to the new version, remove old columns (Contract). Making destructive changes directly (dropping columns, changing types) causes reference errors in old-version instances during a rolling update.

### Q3: What is the right granularity for Feature Flags?

The basic rule is to scope flags to **user-visible features**. If a single Flag controls multiple independent features, you cannot disable just one, making operations difficult. Conversely, flags that are too fine-grained (e.g., per button color change) increase management overhead. A good rule of thumb: "Is the user experience consistent when this Flag is OFF?"

### Q4: How frequently should I deploy?

DORA metrics show that "Elite" performers deploy multiple times per day. However, frequency itself is not the goal — the aim should be to reach a state where "small changes can be deployed safely and confidently." By using Feature Flags, you can increase code deployment frequency while controlling the release (public rollout to users) more carefully.

### Q5: What are the risks of old and new versions coexisting during a Rolling Update?

Address this with API versioning (v1/v2) and forward-compatible schema design. Specifically, enforce these rules: (1) only add new fields, never remove them; (2) clients ignore unknown fields; (3) follow the Expand and Contract pattern for DB migrations.

### Q6: How should I set automated rollback thresholds?

Set thresholds based on your service SLA and baseline metrics. Common guidelines: (1) Error rate: more than 2x the baseline (e.g., if normal is 0.1%, threshold is 0.2%), (2) Latency: P99 exceeds 1.5x the baseline, (3) Request success rate: drops below 99%. If thresholds are too strict, false positives will trigger rollbacks frequently — adjust gradually.

---

## 12. Deployment Operations Best Practices

### 12.1 Deployment Checklist

```
Pre-deployment checks:
  [  ] All tests (unit / integration / e2e) are passing
  [  ] Code review has been approved
  [  ] DB migrations follow the Expand and Contract pattern
  [  ] Changes to environment variables/secrets are documented
  [  ] Rollback procedures are clearly defined
  [  ] Feature Flag state has been confirmed
  [  ] Impact on dependent services has been assessed

During deployment checks:
  [  ] Health checks are returning normal
  [  ] Error rate has not exceeded the baseline
  [  ] Latency is within acceptable range
  [  ] No abnormal error patterns in logs

Post-deployment checks:
  [  ] Smoke tests have passed
  [  ] Key user flows (login, purchase, etc.) are working normally
  [  ] No anomalies on the metrics dashboard
  [  ] Previous version Feature Flags are marked as cleanup candidates
```

### 12.2 Deployment Frequency and Organizational Performance

```
Performance classification by DORA metrics:

Metric                  | Elite          | High          | Medium         | Low
Deploy Frequency        | Multiple/day   | Weekly-Monthly| Monthly-6mo    | 6mo+
Change Lead Time        | < 1 hour       | 1 day-1 week  | 1 week-1 month | 1 month+
Change Failure Rate     | 0-15%          | 16-30%        | 16-30%         | 46-60%
Service Recovery Time   | < 1 hour       | < 1 day       | 1 day-1 week   | 6 months+

Improvement approaches:
1. Test automation → Reduce change failure rate
2. CI/CD pipeline optimization → Shorten lead time
3. Feature Flag + Canary → Increase deployment frequency
4. Automated rollback + monitoring → Reduce recovery time
```

### 12.3 Deployment Notification Template

```yaml
# .github/workflows/deploy-notification.yml
name: Deploy Notification

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      version:
        required: true
        type: string
      status:
        required: true
        type: string

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Post Slack Notification
        uses: slackapi/slack-github-action@v2.0.0
        with:
          webhook: ${{ secrets.SLACK_DEPLOY_WEBHOOK }}
          webhook-type: incoming-webhook
          payload: |
            {
              "blocks": [
                {
                  "type": "header",
                  "text": {
                    "type": "plain_text",
                    "text": "Deploy ${{ inputs.status == 'success' && 'Completed' || 'Failed' }}"
                  }
                },
                {
                  "type": "section",
                  "fields": [
                    { "type": "mrkdwn", "text": "*Environment:*\n`${{ inputs.environment }}`" },
                    { "type": "mrkdwn", "text": "*Version:*\n`${{ inputs.version }}`" },
                    { "type": "mrkdwn", "text": "*Actor:*\n${{ github.actor }}" },
                    { "type": "mrkdwn", "text": "*Status:*\n${{ inputs.status == 'success' && ':white_check_mark: Success' || ':x: Failed' }}" }
                  ]
                },
                {
                  "type": "actions",
                  "elements": [
                    {
                      "type": "button",
                      "text": { "type": "plain_text", "text": "View Run" },
                      "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                    }
                  ]
                }
              ]
            }
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|------------|
| Recreate | Simplest but has downtime. Suited for dev environments and batch jobs |
| Rolling Update | Kubernetes default. Zero downtime through staged replacement |
| Blue-Green | Prepare 2 environments and switch instantly. Fastest rollback |
| Canary | Validate with small traffic. Minimizes risk |
| Feature Flag | Separate deployment from release. Essential for phased rollout |
| DB Migration | Maintain forward compatibility with the Expand and Contract pattern |
| Rollback | Prepare procedures in advance and set automated rollback thresholds |
| Health Check | Validate through two levels — shallow and deep — including dependencies |
| Deploy Frequency | Deploy small and often, control releases with Feature Flags |
| DORA Metrics | Continuously measure deploy frequency, lead time, failure rate, and recovery time |

---

## What to Read Next

- [01-cloud-deployment.md](./01-cloud-deployment.md) — Practical cloud deployment to AWS/Vercel/Cloudflare Workers
- [02-container-deployment.md](./02-container-deployment.md) — Container deployment on ECS/Kubernetes
- [03-release-management.md](./03-release-management.md) — Semantic versioning and release management

---

## References

1. **Accelerate** — Nicole Forsgren, Jez Humble, Gene Kim (2018) — Scientific analysis of deployment frequency and lead time
2. **Continuous Delivery** — Jez Humble, David Farley (2010) — The original text on deployment pipelines
3. **Kubernetes Documentation - Deployments** — https://kubernetes.io/docs/concepts/workloads/controllers/deployment/ — Official reference for Rolling Updates
4. **Martin Fowler - Feature Toggles** — https://martinfowler.com/articles/feature-toggles.html — Pattern classification for Feature Flags
5. **Argo Rollouts** — https://argoproj.github.io/rollouts/ — Advanced deployment strategies for Kubernetes
6. **DORA Metrics** — https://dora.dev/research/ — Research on deployment frequency and organizational performance
