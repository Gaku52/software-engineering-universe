# Well-Architected Framework — 6 Pillars and Review Process

> A practical guide for understanding the 6 pillars of the AWS Well-Architected Framework and systematically reviewing and improving your workloads.

---

## What You Will Learn

1. Design principles and best practices for each of the **6 pillars**
2. How to conduct workload reviews using the **Well-Architected Tool**
3. **Prioritizing improvements** and the continuous architecture improvement process
4. Integration with **Trusted Advisor** and automated checks
5. Automating Well-Architected compliance with **CDK / CloudFormation**


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Cost Optimization — Cost Explorer / Budgets / Savings Plans](./00-cost-optimization.md)

---

## 1. Overview of the Well-Architected Framework

### 1.1 The 6 Pillars

```
┌──────────────────────────────────────────────────────────┐
│            AWS Well-Architected Framework                 │
│                      6 Pillars                           │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 1. Operational│  │ 2. Security  │  │ 3. Reliability│  │
│  │   Excellence  │  │              │  │              │   │
│  │              │  │             │  │              │   │
│  │              │  │             │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 4. Performance│  │ 5. Cost      │  │ 6. Sustain-  │   │
│  │   Efficiency  │  │   Optimization│  │   ability    │   │
│  │              │  │              │  │              │   │
│  │              │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 1.2 Relationship Between the Pillars

```
                   ┌─────────────────┐
                   │  Business Value  │
                   └────────┬────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │ Security  │   │Reliability│   │Performance│
     │(Foundation)│  │(Foundation)│  │           │
     └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
           │                │                │
           └────────────────┼────────────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
     ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
     │Operational│   │   Cost    │   │Sustain-   │
     │Excellence │   │Optimization│  │ ability   │
     │(Cross-cut)│   │(Optimize) │   │(Optimize) │
     └───────────┘   └───────────┘   └───────────┘
```

### 1.3 When to Apply the Framework

The Well-Architected Framework applies throughout the entire workload lifecycle.

```
┌─────────────────────────────────────────────────────────────────┐
│  Workload Lifecycle and Well-Architected                        │
│                                                                 │
│  Design Phase ──→ Build Phase ──→ Operate Phase ──→ Optimize   │
│       │               │               │                │        │
│       ▼               ▼               ▼                ▼        │
│  ┌─────────┐   ┌─────────┐   ┌─────────────┐  ┌──────────┐    │
│  │Design   │   │Build    │   │Periodic     │  │Improvement│   │
│  │Review   │   │Review   │   │Review       │  │Review     │   │
│  │(Initial)│   │(Pre-    │   │(Quarterly)  │  │(Post-     │   │
│  │         │   │launch)  │   │             │  │change)    │    │
│  └─────────┘   └─────────┘   └─────────────┘  └──────────┘    │
│                                                                 │
│  Key Points:                                                    │
│  - Design: Validate architecture decisions                      │
│  - Pre-launch: Final checks before production                   │
│  - Operations: Drift detection and continuous improvement       │
│  - Post-change: Impact assessment after major architecture changes│
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Basic Well-Architected Tool Operations (CLI)

```bash
# List workloads
aws wellarchitected list-workloads \
  --query 'WorkloadSummaries[*].{Name:WorkloadName,Id:WorkloadId,Risk:RiskCounts}'

# Create a workload
aws wellarchitected create-workload \
  --workload-name "MyApp-Production" \
  --description "Production e-commerce application" \
  --environment PRODUCTION \
  --review-owner "architect@example.com" \
  --lenses wellarchitected serverless \
  --aws-regions ap-northeast-1 \
  --tags Project=myapp,Environment=production

# Get the list of questions for a specific pillar
aws wellarchitected list-answers \
  --workload-id "abc123def456" \
  --lens-alias wellarchitected \
  --pillar-id operationalExcellence \
  --query 'AnswerSummaries[*].{Q:QuestionTitle,Risk:Risk}'

# Update an answer to a question
aws wellarchitected update-answer \
  --workload-id "abc123def456" \
  --lens-alias wellarchitected \
  --question-id "ops-how-do-you-design-workload" \
  --selected-choices "ops_ops-how-do-you-design-workload_1" "ops_ops-how-do-you-design-workload_2" \
  --notes "IaC with CDK, CI/CD with CodePipeline"

# Create a milestone
aws wellarchitected create-milestone \
  --workload-id "abc123def456" \
  --milestone-name "Q1-2025-Review"

# Get the review report
aws wellarchitected get-lens-review-report \
  --workload-id "abc123def456" \
  --lens-alias wellarchitected \
  --query 'LensReviewReport.Base64String' \
  --output text | base64 --decode > wa-report.pdf
```

---

## 2. Details of the 6 Pillars

### 2.1 Pillar 1: Operational Excellence

```yaml
# Design principles
principles:
  - Perform operations as code (IaC)
  - Make frequent, small, reversible changes
  - Refine operations procedures frequently
  - Anticipate failure
  - Learn from all operational failures

# Example checklist
checklist:
  organization:
    - Are team responsibilities clearly defined?
    - Are operational priorities aligned with business goals?
  prepare:
    - Is workload observability designed in?
    - Are deployment strategies (Blue/Green, Canary) defined?
  operate:
    - Are runbooks and playbooks maintained?
    - Are dashboards and alerts configured appropriately?
  evolve:
    - Is there a post-mortem (retrospective) process?
    - Are improvement items added to the backlog?
```

#### Operational Excellence — Key AWS Services and Implementation Patterns

```bash
# === Implementing IaC (Infrastructure as Code) ===

# Detect stack drift in CloudFormation
aws cloudformation detect-stack-drift --stack-name my-production-stack
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id "aaaabbbb-1234-5678"

# Automate runbooks with Systems Manager Automation
aws ssm start-automation-execution \
  --document-name "AWS-RestartEC2Instance" \
  --parameters '{"InstanceId":["i-0123456789abcdef0"]}'

# === Implementing Observability ===

# Create a CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "ProductionOverview" \
  --dashboard-body file://dashboard-definition.json

# Create an X-Ray tracing group
aws xray create-group \
  --group-name "HighLatencyTraces" \
  --filter-expression 'responsetime > 5'

# Monitor endpoints with CloudWatch Synthetics Canary
aws synthetics create-canary \
  --name "api-health-check" \
  --artifact-s3-location "s3://my-canary-artifacts/" \
  --execution-role-arn "arn:aws:iam::123456789012:role/canary-role" \
  --schedule '{"Expression":"rate(5 minutes)"}' \
  --runtime-version "syn-nodejs-puppeteer-6.2" \
  --code '{"Handler":"apiCanary.handler","ZipFile":"..."}'

# === Deployment Strategies ===

# Configure Blue/Green deployment with CodeDeploy
aws deploy create-deployment-group \
  --application-name MyApp \
  --deployment-group-name Production \
  --deployment-config-name CodeDeployDefault.ECSLinear10PercentEvery1Minutes \
  --ecs-services '[{"ServiceName":"my-service","ClusterName":"my-cluster"}]' \
  --load-balancer-info '{"TargetGroupPairInfoList":[{"TargetGroups":[{"Name":"blue-tg"},{"Name":"green-tg"}],"ProdTrafficRoute":{"ListenerArns":["arn:aws:elasticloadbalancing:..."]}}]}'
```

```python
# Figure 1: Script to auto-generate operations dashboards
import boto3
import json

def create_operations_dashboard(stack_name: str, region: str = "ap-northeast-1"):
    """Automatically generate an operations dashboard from a CloudFormation stack"""
    cf_client = boto3.client("cloudformation", region_name=region)
    cw_client = boto3.client("cloudwatch", region_name=region)

    # Get stack resources
    resources = cf_client.list_stack_resources(StackName=stack_name)
    widgets = []
    y_pos = 0

    for resource in resources["StackResourceSummaries"]:
        resource_type = resource["ResourceType"]
        logical_id = resource["LogicalResourceId"]
        physical_id = resource["PhysicalResourceId"]

        if resource_type == "AWS::ECS::Service":
            # CPU/memory widget for ECS service
            cluster_name, service_name = physical_id.rsplit("/", 1)
            widgets.append({
                "type": "metric",
                "x": 0, "y": y_pos, "width": 12, "height": 6,
                "properties": {
                    "title": f"ECS: {logical_id}",
                    "metrics": [
                        ["AWS/ECS", "CPUUtilization", "ServiceName", service_name,
                         "ClusterName", cluster_name.split("/")[-1]],
                        [".", "MemoryUtilization", ".", ".", ".", "."],
                    ],
                    "period": 300,
                    "stat": "Average",
                    "region": region,
                },
            })
            y_pos += 6

        elif resource_type == "AWS::RDS::DBInstance":
            # Connection count/CPU widget for RDS
            widgets.append({
                "type": "metric",
                "x": 0, "y": y_pos, "width": 12, "height": 6,
                "properties": {
                    "title": f"RDS: {logical_id}",
                    "metrics": [
                        ["AWS/RDS", "CPUUtilization",
                         "DBInstanceIdentifier", physical_id],
                        [".", "DatabaseConnections", ".", "."],
                        [".", "FreeStorageSpace", ".", "."],
                    ],
                    "period": 300,
                    "stat": "Average",
                    "region": region,
                },
            })
            y_pos += 6

        elif resource_type == "AWS::Lambda::Function":
            # Error rate/duration widget for Lambda
            widgets.append({
                "type": "metric",
                "x": 0, "y": y_pos, "width": 12, "height": 6,
                "properties": {
                    "title": f"Lambda: {logical_id}",
                    "metrics": [
                        ["AWS/Lambda", "Errors", "FunctionName", physical_id],
                        [".", "Duration", ".", "."],
                        [".", "ConcurrentExecutions", ".", "."],
                    ],
                    "period": 300,
                    "stat": "Sum",
                    "region": region,
                },
            })
            y_pos += 6

    # Create dashboard
    dashboard_body = {"widgets": widgets}
    cw_client.put_dashboard(
        DashboardName=f"{stack_name}-operations",
        DashboardBody=json.dumps(dashboard_body),
    )
    print(f"Dashboard created: {stack_name}-operations ({len(widgets)} widgets)")
    return dashboard_body
```

### 2.2 Pillar 2: Security

```yaml
principles:
  - Implement a strong identity foundation
  - Enable traceability
  - Apply security at all layers
  - Automate security best practices
  - Protect data in transit and at rest
  - Keep people away from data
  - Prepare for security events

checklist:
  identity:
    - Is MFA enforced for all IAM users?
    - Is the root account not used for daily operations?
    - Is the principle of least privilege applied?
  detection:
    - Is CloudTrail enabled in all regions?
    - Is GuardDuty enabled?
    - Is Security Hub configured?
  protection:
    - Are VPC flow logs enabled?
    - Is WAF configured?
    - Is data encrypted (KMS)?
```

#### Security — Implementing Automated Auditing and Remediation

```python
# Figure 2: Script to aggregate Security Hub findings and trigger auto-remediation
import boto3
from datetime import datetime, timedelta

def audit_security_hub_findings(region: str = "ap-northeast-1"):
    """Retrieve CRITICAL/HIGH Security Hub findings and generate remediation actions"""
    sh_client = boto3.client("securityhub", region_name=region)

    # Get CRITICAL/HIGH findings from the past 7 days
    response = sh_client.get_findings(
        Filters={
            "SeverityLabel": [
                {"Value": "CRITICAL", "Comparison": "EQUALS"},
                {"Value": "HIGH", "Comparison": "EQUALS"},
            ],
            "WorkflowStatus": [
                {"Value": "NEW", "Comparison": "EQUALS"},
            ],
            "RecordState": [
                {"Value": "ACTIVE", "Comparison": "EQUALS"},
            ],
            "CreatedAt": [
                {
                    "Start": (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z",
                    "End": datetime.utcnow().isoformat() + "Z",
                }
            ],
        },
        SortCriteria=[
            {"Field": "SeverityLabel", "SortOrder": "desc"},
        ],
        MaxResults=100,
    )

    findings_by_pillar = {
        "identity": [],
        "detection": [],
        "protection": [],
        "data_protection": [],
        "incident_response": [],
    }

    for finding in response["Findings"]:
        title = finding["Title"]
        severity = finding["Severity"]["Label"]
        resource_type = finding["Resources"][0]["Type"] if finding["Resources"] else "Unknown"
        resource_id = finding["Resources"][0]["Id"] if finding["Resources"] else "Unknown"

        item = {
            "title": title,
            "severity": severity,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "standard": finding.get("ProductFields", {}).get("StandardsControlArn", ""),
            "remediation": finding.get("Remediation", {}).get("Recommendation", {}).get("Text", ""),
        }

        # Classify findings by category
        if "IAM" in title or "MFA" in title or "credential" in title.lower():
            findings_by_pillar["identity"].append(item)
        elif "CloudTrail" in title or "GuardDuty" in title or "logging" in title.lower():
            findings_by_pillar["detection"].append(item)
        elif "encryption" in title.lower() or "KMS" in title or "S3" in title:
            findings_by_pillar["data_protection"].append(item)
        elif "VPC" in title or "Security Group" in title or "WAF" in title:
            findings_by_pillar["protection"].append(item)
        else:
            findings_by_pillar["incident_response"].append(item)

    # Generate summary report
    total = sum(len(v) for v in findings_by_pillar.values())
    print(f"=== Security Hub Audit Report ===")
    print(f"Total findings: {total}")
    for category, items in findings_by_pillar.items():
        if items:
            print(f"\n[{category.upper()}] ({len(items)} findings)")
            for item in items:
                print(f"  [{item['severity']}] {item['title']}")
                print(f"    Resource: {item['resource_id']}")
                if item["remediation"]:
                    print(f"    Fix: {item['remediation'][:100]}...")

    return findings_by_pillar
```

```bash
# Enable Security Hub and apply standards
aws securityhub enable-security-hub \
  --enable-default-standards

# Enable CIS AWS Foundations Benchmark
aws securityhub batch-enable-standards \
  --standards-subscription-requests '[
    {"StandardsArn":"arn:aws:securityhub:::ruleset/cis-aws-foundations-benchmark/v/1.4.0"}
  ]'

# Enable GuardDuty
aws guardduty create-detector --enable

# Get compliance summary for Config Rules
aws configservice get-compliance-summary-by-config-rule \
  --query 'ComplianceSummary.{Compliant:CompliantResourceCount.CappedCount,NonCompliant:NonCompliantResourceCount.CappedCount}'
```

### 2.3 Pillar 3: Reliability

```yaml
principles:
  - Automatically recover from failure
  - Test recovery procedures
  - Scale horizontally
  - Stop guessing capacity
  - Manage change through automation

checklist:
  foundations:
    - Are service quotas properly configured?
    - Is the network topology redundant?
  workload_architecture:
    - Is failure isolation achieved with microservices or SOA?
    - Is failure handling implemented in distributed systems?
  change_management:
    - Is Auto Scaling configured?
    - Are changes monitored?
  failure_management:
    - Are backup and DR strategies defined?
    - Are RTO/RPO clearly defined?
```

#### Reliability — DR Strategies and Implementation Patterns

```
┌──────────────────────────────────────────────────────────────────┐
│                   DR Strategy Comparison                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Strategy     │ RTO      │ RPO      │ Cost   │ Complexity   │ │
│  │─────────────│──────────│──────────│────────│─────────────│ │
│  │ Backup &    │ 24h+     │ 24h      │ $      │ Low          │ │
│  │ Restore     │          │          │        │              │ │
│  │─────────────│──────────│──────────│────────│─────────────│ │
│  │ Pilot Light │ Hours    │ Minutes  │ $$     │ Medium       │ │
│  │─────────────│──────────│──────────│────────│─────────────│ │
│  │ Warm        │ Minutes  │ Seconds  │ $$$    │ Medium-High  │ │
│  │ Standby     │          │          │        │              │ │
│  │─────────────│──────────│──────────│────────│─────────────│ │
│  │ Multi-Site  │ Real-    │ Near     │ $$$$   │ High         │ │
│  │ Active      │ time     │ Zero     │        │              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

```bash
# === Service Quota Management ===

# Check current quota values
aws service-quotas get-service-quota \
  --service-code ec2 \
  --quota-code L-1216C47A  # Running On-Demand Standard instances

# Request a quota increase
aws service-quotas request-service-quota-increase \
  --service-code ec2 \
  --quota-code L-1216C47A \
  --desired-value 200

# === Backup Strategy ===

# Create an AWS Backup plan
aws backup create-backup-plan --backup-plan '{
  "BackupPlanName": "DailyBackup",
  "Rules": [
    {
      "RuleName": "DailyRule",
      "TargetBackupVaultName": "Default",
      "ScheduleExpression": "cron(0 3 * * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 120,
      "Lifecycle": {
        "DeleteAfterDays": 35,
        "MoveToColdStorageAfterDays": 7
      },
      "CopyActions": [
        {
          "DestinationBackupVaultArn": "arn:aws:backup:us-west-2:123456789012:backup-vault:DR-Vault",
          "Lifecycle": {"DeleteAfterDays": 90}
        }
      ]
    }
  ]
}'

# === Route 53 Health Checks ===

# Create a health check
aws route53 create-health-check --caller-reference "$(date +%s)" \
  --health-check-config '{
    "IPAddress": "203.0.113.1",
    "Port": 443,
    "Type": "HTTPS",
    "ResourcePath": "/health",
    "FullyQualifiedDomainName": "api.example.com",
    "RequestInterval": 10,
    "FailureThreshold": 3,
    "EnableSNI": true
  }'

# Create a failover record
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "alb-primary.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        },
        "HealthCheckId": "abcd1234-5678-efgh"
      }
    }]
  }'
```

```python
# Figure 3: Script to automatically monitor service quotas
import boto3

def check_service_quotas(services: list[str], threshold_pct: float = 80.0):
    """Check service quota utilization and alert when threshold is exceeded"""
    sq_client = boto3.client("service-quotas", region_name="ap-northeast-1")
    alerts = []

    for service_code in services:
        try:
            paginator = sq_client.get_paginator("list_service_quotas")
            for page in paginator.paginate(ServiceCode=service_code):
                for quota in page["Quotas"]:
                    quota_name = quota["QuotaName"]
                    quota_value = quota["Value"]

                    # Get usage (if available)
                    if quota.get("UsageMetric"):
                        metric = quota["UsageMetric"]
                        cw_client = boto3.client("cloudwatch", region_name="ap-northeast-1")
                        stats = cw_client.get_metric_statistics(
                            Namespace=metric["MetricNamespace"],
                            MetricName=metric["MetricName"],
                            Dimensions=[
                                {"Name": k, "Value": v}
                                for k, v in metric.get("MetricDimensions", {}).items()
                            ],
                            StartTime="2025-01-01T00:00:00Z",
                            EndTime="2025-01-02T00:00:00Z",
                            Period=86400,
                            Statistics=[metric.get("MetricStatisticRecommendation", "Maximum")],
                        )
                        if stats["Datapoints"]:
                            usage = stats["Datapoints"][0].get("Maximum", 0)
                            usage_pct = (usage / quota_value) * 100 if quota_value > 0 else 0

                            if usage_pct >= threshold_pct:
                                alerts.append({
                                    "service": service_code,
                                    "quota": quota_name,
                                    "limit": quota_value,
                                    "usage": usage,
                                    "usage_pct": round(usage_pct, 1),
                                })
        except Exception as e:
            print(f"Error checking {service_code}: {e}")

    # Alert report
    if alerts:
        print(f"⚠ {len(alerts)} quotas above {threshold_pct}% threshold:")
        for a in alerts:
            print(f"  [{a['service']}] {a['quota']}: {a['usage']}/{a['limit']} ({a['usage_pct']}%)")
    else:
        print(f"All quotas below {threshold_pct}% threshold")

    return alerts

# Usage example
# check_service_quotas(["ec2", "lambda", "rds", "elasticloadbalancing"])
```

### 2.4 Pillar 4: Performance Efficiency

```yaml
principles:
  - Democratize advanced technologies
  - Go global in minutes
  - Use serverless architectures
  - Experiment more often
  - Consider mechanical sympathy

checklist:
  selection:
    - Is the optimal compute type selected for the workload?
      (EC2 / Lambda / ECS / EKS / Fargate)
    - Is the storage type appropriate? (gp3 / io2 / S3 Intelligent-Tiering)
    - Is the database engine appropriate? (Aurora / DynamoDB / ElastiCache)
  review:
    - Are benchmark tests conducted regularly?
    - Is performance continuously monitored with CloudWatch metrics?
  monitoring:
    - Are P50/P90/P99 latencies measured?
    - Is there a process for identifying bottlenecks? (X-Ray / Profiler)
  tradeoffs:
    - Is a caching strategy defined? (CloudFront / ElastiCache / DAX)
    - Are read replicas being utilized?
```

```bash
# === Performance Analysis ===

# Get Compute Optimizer recommendations
aws compute-optimizer get-ec2-instance-recommendations \
  --query 'InstanceRecommendations[*].{
    Instance:InstanceArn,
    Current:CurrentInstanceType,
    Recommended:RecommendationOptions[0].InstanceType,
    Finding:Finding,
    Savings:RecommendationOptions[0].ProjectedUtilizationMetrics[?Name==`CPU`].Value|[0]
  }'

# Analyze Lambda function performance
aws lambda get-function-configuration \
  --function-name my-function \
  --query '{MemorySize:MemorySize,Timeout:Timeout,Architecture:Architectures[0]}'

# Check Lambda Power Tuning results (run via Step Functions)
# Identify optimal memory size: compare 128MB → 256MB → 512MB → 1024MB

# Check CloudFront cache hit rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name CacheHitRate \
  --dimensions Name=DistributionId,Value=E1234567890 \
  --start-time "$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 86400 \
  --statistics Average

# Enable RDS Performance Insights
aws rds modify-db-instance \
  --db-instance-identifier my-database \
  --enable-performance-insights \
  --performance-insights-retention-period 731
```

```python
# Figure 4: Script to automatically retrieve performance baselines
import boto3
from datetime import datetime, timedelta

def get_performance_baseline(resource_type: str, resource_id: str, days: int = 30):
    """Retrieve the performance baseline for a resource over the past N days"""
    cw = boto3.client("cloudwatch", region_name="ap-northeast-1")
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(days=days)

    metrics_map = {
        "ec2": {
            "namespace": "AWS/EC2",
            "dimension": "InstanceId",
            "metrics": ["CPUUtilization", "NetworkIn", "NetworkOut",
                        "EBSReadOps", "EBSWriteOps"],
        },
        "rds": {
            "namespace": "AWS/RDS",
            "dimension": "DBInstanceIdentifier",
            "metrics": ["CPUUtilization", "DatabaseConnections",
                        "ReadLatency", "WriteLatency", "FreeableMemory"],
        },
        "lambda": {
            "namespace": "AWS/Lambda",
            "dimension": "FunctionName",
            "metrics": ["Duration", "Errors", "Throttles", "ConcurrentExecutions"],
        },
        "alb": {
            "namespace": "AWS/ApplicationELB",
            "dimension": "LoadBalancer",
            "metrics": ["TargetResponseTime", "HTTPCode_Target_5XX_Count",
                        "RequestCount", "ActiveConnectionCount"],
        },
    }

    config = metrics_map.get(resource_type)
    if not config:
        raise ValueError(f"Unsupported resource type: {resource_type}")

    baseline = {}
    for metric_name in config["metrics"]:
        response = cw.get_metric_statistics(
            Namespace=config["namespace"],
            MetricName=metric_name,
            Dimensions=[{"Name": config["dimension"], "Value": resource_id}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,  # daily
            Statistics=["Average", "Maximum", "p99"],
            ExtendedStatistics=["p50", "p90", "p99"],
        )

        datapoints = sorted(response.get("Datapoints", []), key=lambda x: x["Timestamp"])
        if datapoints:
            averages = [dp["Average"] for dp in datapoints if "Average" in dp]
            maximums = [dp["Maximum"] for dp in datapoints if "Maximum" in dp]
            baseline[metric_name] = {
                "avg": round(sum(averages) / len(averages), 2) if averages else 0,
                "max": round(max(maximums), 2) if maximums else 0,
                "trend": "increasing" if len(averages) > 1 and averages[-1] > averages[0] else "stable",
            }

    print(f"=== Performance Baseline: {resource_type}/{resource_id} ({days} days) ===")
    for metric, stats in baseline.items():
        trend_indicator = "↑" if stats["trend"] == "increasing" else "→"
        print(f"  {metric}: avg={stats['avg']}, max={stats['max']} {trend_indicator}")

    return baseline
```

### 2.5 Pillar 5: Cost Optimization

```yaml
principles:
  - Implement cloud financial management
  - Adopt a consumption model
  - Measure overall efficiency
  - Stop spending money on undifferentiated heavy lifting
  - Analyze and attribute expenditure

checklist:
  practice_cloud_financial_management:
    - Are cost allocation tags applied to all resources?
    - Are budget alerts configured? (AWS Budgets)
    - Are monthly cost review meetings held?
  expenditure_and_usage_awareness:
    - Is Cost Explorer used to analyze usage?
    - Are unused resources (EIP, EBS, snapshots) inventoried regularly?
  cost_effective_resources:
    - Are Savings Plans / Reserved Instances being utilized?
    - Has the use of Spot Instances been considered?
    - Has migration to Graviton (ARM) instances been considered?
  manage_demand_and_supply:
    - Is Auto Scaling used to scale with demand?
    - Has migration to serverless architecture been considered?
  optimize_over_time:
    - Are Compute Optimizer recommendations reviewed regularly?
    - Is S3 Intelligent-Tiering being utilized?
```

```bash
# === Cost Visualization and Optimization ===

# Check active cost allocation tags
aws ce list-cost-allocation-tags \
  --status Active \
  --query 'CostAllocationTags[*].TagKey'

# Monthly cost summary
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-02-01 \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UsageQuantity" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[0].Groups | sort_by(@, &Metrics.BlendedCost.Amount) | reverse(@) | [:10]'

# Detect unused resources
# Unused EIPs
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId==null].{IP:PublicIp,AllocId:AllocationId}'

# Unattached EBS volumes
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].{Id:VolumeId,Size:Size,Type:VolumeType,Created:CreateTime}'

# Old EBS snapshots (older than 90 days)
aws ec2 describe-snapshots --owner-ids self \
  --query "Snapshots[?StartTime<='$(date -u -v-90d +%Y-%m-%dT%H:%M:%S)'].{Id:SnapshotId,Size:VolumeSize,Date:StartTime}"

# Check Savings Plans coverage
aws ce get-savings-plans-coverage \
  --time-period Start=2025-01-01,End=2025-02-01 \
  --query 'SavingsPlansCoverages[*].{Date:TimePeriod.Start,Coverage:CoveragePercentage}'

# Get Savings Plans purchase recommendations
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --term-in-years ONE_YEAR \
  --payment-option NO_UPFRONT \
  --lookback-period-in-days SIXTY_DAYS
```

```python
# Figure 5: Script to detect cost anomalies and send automated alerts
import boto3
from datetime import datetime, timedelta

def detect_cost_anomalies(threshold_pct: float = 20.0):
    """Detect cost anomalies compared to the previous month"""
    ce = boto3.client("ce", region_name="us-east-1")

    # Get costs for this month and last month
    today = datetime.utcnow()
    this_month_start = today.replace(day=1).strftime("%Y-%m-%d")
    last_month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1).strftime("%Y-%m-%d")
    last_month_end = today.replace(day=1).strftime("%Y-%m-%d")

    # Last month's cost by service
    last_month = ce.get_cost_and_usage(
        TimePeriod={"Start": last_month_start, "End": last_month_end},
        Granularity="MONTHLY",
        Metrics=["BlendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    # This month's cost by service (prorated)
    this_month = ce.get_cost_and_usage(
        TimePeriod={"Start": this_month_start, "End": today.strftime("%Y-%m-%d")},
        Granularity="MONTHLY",
        Metrics=["BlendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    days_elapsed = (today - today.replace(day=1)).days or 1
    days_in_month = 30  # approximate

    anomalies = []
    last_costs = {}
    for group in last_month["ResultsByTime"][0].get("Groups", []):
        service = group["Keys"][0]
        cost = float(group["Metrics"]["BlendedCost"]["Amount"])
        last_costs[service] = cost

    for group in this_month["ResultsByTime"][0].get("Groups", []):
        service = group["Keys"][0]
        current_cost = float(group["Metrics"]["BlendedCost"]["Amount"])
        projected_cost = current_cost * (days_in_month / days_elapsed)

        last_cost = last_costs.get(service, 0)
        if last_cost > 1:  # only services with more than $1
            change_pct = ((projected_cost - last_cost) / last_cost) * 100
            if change_pct > threshold_pct:
                anomalies.append({
                    "service": service,
                    "last_month": round(last_cost, 2),
                    "projected": round(projected_cost, 2),
                    "change_pct": round(change_pct, 1),
                })

    anomalies.sort(key=lambda x: x["change_pct"], reverse=True)

    print(f"=== Cost Anomaly Report (threshold: +{threshold_pct}%) ===")
    for a in anomalies:
        print(f"  {a['service']}: ${a['last_month']} → ${a['projected']} (+{a['change_pct']}%)")

    return anomalies
```

### 2.6 Pillar 6: Sustainability

```yaml
principles:
  - Understand your impact
  - Establish sustainability goals
  - Maximize utilization
  - Anticipate and adopt new, more efficient hardware and software
  - Use managed services
  - Reduce the downstream impact of your cloud workloads

checklist:
  region_selection:
    - Is a region with a high proportion of carbon-free energy selected?
    - Is unnecessary data transfer minimized by using a region close to users?
  compute:
    - Are Graviton (ARM) processors being used?
    - Are Spot Instances used to leverage spare capacity?
    - Is Lambda used to eliminate resource consumption during idle time?
  storage:
    - Is S3 Intelligent-Tiering used for automatic storage class optimization?
    - Are lifecycle policies configured for data that is no longer needed?
  data_transfer:
    - Is CloudFront used for edge caching?
    - Are VPC endpoints used to reduce unnecessary internet traffic?
```

```bash
# === Sustainability Practices ===

# Check Graviton instance utilization
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].{
    Id:InstanceId,
    Type:InstanceType,
    Arch:Architecture,
    Platform:PlatformDetails
  }' --output table

# Customer Carbon Footprint Tool (available in the console only)
# Alternative: estimate CO2-related metrics with CloudWatch

# Configure S3 Intelligent-Tiering
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket my-data-bucket \
  --id "FullTiering" \
  --intelligent-tiering-configuration '{
    "Id": "FullTiering",
    "Status": "Enabled",
    "Tierings": [
      {"AccessTier": "ARCHIVE_ACCESS", "Days": 90},
      {"AccessTier": "DEEP_ARCHIVE_ACCESS", "Days": 180}
    ]
  }'

# Configure S3 lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-logs-bucket \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "LogRetention",
        "Status": "Enabled",
        "Filter": {"Prefix": "logs/"},
        "Transitions": [
          {"Days": 30, "StorageClass": "STANDARD_IA"},
          {"Days": 90, "StorageClass": "GLACIER"},
          {"Days": 365, "StorageClass": "DEEP_ARCHIVE"}
        ],
        "Expiration": {"Days": 730}
      }
    ]
  }'
```

### 2.7 Summary of Best Practices for the 6 Pillars

```python
# Example script to automate a Well-Architected review
import boto3

def run_well_architected_review():
    """Automate a workload review with the Well-Architected Tool"""
    wa_client = boto3.client("wellarchitected", region_name="ap-northeast-1")

    # Create workload
    workload = wa_client.create_workload(
        WorkloadName="MyApp Production",
        Description="Main production workload",
        Environment="PRODUCTION",
        ArchitecturalDesign="https://wiki.example.com/architecture",
        ReviewOwner="architect@example.com",
        Lenses=["wellarchitected"],          # AWS Well-Architected Lens
        AwsRegions=["ap-northeast-1"],
        Tags={"Project": "myapp"},
    )

    workload_id = workload["WorkloadId"]

    # Get list of questions
    answers = wa_client.list_answers(
        WorkloadId=workload_id,
        LensAlias="wellarchitected",
        PillarId="operationalExcellence",    # specify pillar
    )

    for answer in answers["AnswerSummaries"]:
        print(f"Q: {answer['QuestionTitle']}")
        print(f"  Risk: {answer.get('Risk', 'UNANSWERED')}")
        print()

    return workload_id
```

### 2.8 Using Lenses

```bash
# List available lenses
aws wellarchitected list-lenses --query 'LensSummaries[*].{Name:LensName,Alias:LensAlias}'

# Commonly used lenses:
# - wellarchitected          : AWS Well-Architected (default)
# - serverless               : Serverless Applications Lens
# - saas                     : SaaS Lens
# - foundational-technical-review : FTR Lens (for APN partners)
# - machine-learning         : Machine Learning Lens

# Create a custom lens
aws wellarchitected create-lens-version \
  --lens-alias "arn:aws:wellarchitected:ap-northeast-1:123456789012:lens/my-custom-lens" \
  --lens-version "2.0.0"

# Associate a lens with a workload
aws wellarchitected associate-lenses \
  --workload-id "abc123def456" \
  --lens-aliases serverless saas

# Get the improvement plan for a lens
aws wellarchitected list-lens-review-improvements \
  --workload-id "abc123def456" \
  --lens-alias wellarchitected \
  --pillar-id security \
  --query 'ImprovementSummaries[*].{Question:QuestionTitle,Risk:Risk,Count:ImprovementPlans|length(@)}'
```

---

## 3. Conducting Reviews with the Well-Architected Tool

### 3.1 Review Process

```
┌─────────────────────────────────────────────────────────┐
│         Well-Architected Review Process                  │
│                                                         │
│  Phase 1: Preparation (1-2 days)                        │
│  ┌───────────────────────────────────────┐              │
│  │ - Prepare architecture diagrams       │              │
│  │ - Identify stakeholders               │              │
│  │ - Organize known risks                │              │
│  └──────────────────┬────────────────────┘              │
│                     ▼                                   │
│  Phase 2: Review (2-5 days)                             │
│  ┌───────────────────────────────────────┐              │
│  │ - Answer questions for each of the    │              │
│  │   6 pillars                           │              │
│  │ - Identify gaps from best practices   │              │
│  │ - Assess risk levels                  │              │
│  │   (High Risk / Medium Risk / No Risk) │              │
│  └──────────────────┬────────────────────┘              │
│                     ▼                                   │
│  Phase 3: Improvement Plan (1-2 days)                   │
│  ┌───────────────────────────────────────┐              │
│  │ - Develop remediation for High Risk   │              │
│  │   items                               │              │
│  │ - Set priorities and milestones       │              │
│  │ - Register improvement items in       │              │
│  │   Jira/Backlog                        │              │
│  └──────────────────┬────────────────────┘              │
│                     ▼                                   │
│  Phase 4: Execute and Re-review (ongoing)               │
│  ┌───────────────────────────────────────┐              │
│  │ - Implement improvements              │              │
│  │ - Re-review quarterly                 │              │
│  │ - Record progress with milestones     │              │
│  └───────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Review Steps

```bash
# Step 1: Create a workload
WORKLOAD_ID=$(aws wellarchitected create-workload \
  --workload-name "E-Commerce-Production" \
  --description "Primary e-commerce platform serving ap-northeast-1" \
  --environment PRODUCTION \
  --review-owner "tech-lead@example.com" \
  --lenses wellarchitected serverless \
  --aws-regions ap-northeast-1 \
  --account-ids 123456789012 987654321098 \
  --tags Project=ecommerce,Team=platform,ReviewCycle=Q1-2025 \
  --query 'WorkloadId' --output text)

echo "Created workload: $WORKLOAD_ID"

# Step 2: Check questions and answer status for each pillar
for PILLAR in operationalExcellence security reliability performance costOptimization sustainability; do
  echo "=== $PILLAR ==="
  aws wellarchitected list-answers \
    --workload-id "$WORKLOAD_ID" \
    --lens-alias wellarchitected \
    --pillar-id "$PILLAR" \
    --query 'AnswerSummaries[*].{Q:QuestionTitle,Risk:Risk}' \
    --output table
done

# Step 3: Update answers (select choices)
aws wellarchitected update-answer \
  --workload-id "$WORKLOAD_ID" \
  --lens-alias wellarchitected \
  --question-id "sec-how-do-you-manage-identities" \
  --selected-choices \
    "sec_sec-how-do-you-manage-identities_1" \
    "sec_sec-how-do-you-manage-identities_2" \
    "sec_sec-how-do-you-manage-identities_3" \
  --notes "IAM Identity Center with SAML 2.0 federation. MFA enforced for all users. Service-linked roles for AWS services."

# Step 4: Create a milestone (snapshot at time of review completion)
aws wellarchitected create-milestone \
  --workload-id "$WORKLOAD_ID" \
  --milestone-name "Q1-2025-Initial-Review"

# Step 5: Get the improvement plan
aws wellarchitected list-lens-review-improvements \
  --workload-id "$WORKLOAD_ID" \
  --lens-alias wellarchitected \
  --pillar-id security \
  --query 'ImprovementSummaries[?Risk==`HIGH`].{Q:QuestionTitle,Risk:Risk}'
```

### 3.3 Improvement Plan Template

```markdown
## Well-Architected Improvement Plan

### High Risk Items (Highest Priority)

| # | Pillar | Question | Current Risk | Remediation Action | Owner | Due |
|---|---|------|------------|---------------|------|------|
| 1 | Security | Credential management | Hardcoded | Introduce Secrets Manager | @security | 2W |
| 2 | Reliability | Backup | Manual/irregular | Automate with AWS Backup | @infra | 3W |
| 3 | Operations | Monitoring | Logs not collected | CloudWatch + X-Ray | @sre | 4W |

### Medium Risk Items (Next Phase)

| # | Pillar | Question | Remediation Action | Due |
|---|---|------|---------------|------|
| 4 | Cost | Right-sizing | Apply Compute Optimizer | Q2 |
| 5 | Performance | Cache strategy | Introduce ElastiCache | Q2 |
```

### 3.4 Automated Report Generation from Review Results

```python
# Figure 6: Script to output Well-Architected review results as a Markdown report
import boto3
from datetime import datetime

def generate_wa_report(workload_id: str, output_file: str = "wa-report.md"):
    """Convert Well-Architected review results to a Markdown report"""
    wa = boto3.client("wellarchitected", region_name="ap-northeast-1")

    # Get workload information
    workload = wa.get_workload(WorkloadId=workload_id)["Workload"]

    # Get the lens review
    review = wa.get_lens_review(
        WorkloadId=workload_id,
        LensAlias="wellarchitected",
    )["LensReview"]

    report_lines = [
        f"# Well-Architected Review Report",
        f"",
        f"**Workload:** {workload['WorkloadName']}",
        f"**Date:** {datetime.utcnow().strftime('%Y-%m-%d')}",
        f"**Environment:** {workload['Environment']}",
        f"**Review Owner:** {workload.get('ReviewOwner', 'N/A')}",
        f"",
        f"## Risk Summary",
        f"",
    ]

    # Risk summary
    risk_counts = review.get("RiskCounts", {})
    total_questions = sum(risk_counts.values())
    report_lines.extend([
        f"| Risk Level | Count | Percentage |",
        f"|-----------|-------|-----------|",
        f"| HIGH | {risk_counts.get('HIGH', 0)} | {risk_counts.get('HIGH', 0)/total_questions*100:.0f}% |",
        f"| MEDIUM | {risk_counts.get('MEDIUM', 0)} | {risk_counts.get('MEDIUM', 0)/total_questions*100:.0f}% |",
        f"| NONE | {risk_counts.get('NONE', 0)} | {risk_counts.get('NONE', 0)/total_questions*100:.0f}% |",
        f"| UNANSWERED | {risk_counts.get('UNANSWERED', 0)} | {risk_counts.get('UNANSWERED', 0)/total_questions*100:.0f}% |",
        f"",
    ])

    # Details by pillar
    pillars = [
        ("operationalExcellence", "Operational Excellence"),
        ("security", "Security"),
        ("reliability", "Reliability"),
        ("performance", "Performance Efficiency"),
        ("costOptimization", "Cost Optimization"),
        ("sustainability", "Sustainability"),
    ]

    for pillar_id, pillar_name in pillars:
        report_lines.extend([f"", f"## {pillar_name}", f""])

        answers = wa.list_answers(
            WorkloadId=workload_id,
            LensAlias="wellarchitected",
            PillarId=pillar_id,
        )

        report_lines.extend([
            f"| Question | Risk | Notes |",
            f"|---------|------|-------|",
        ])

        for ans in answers["AnswerSummaries"]:
            risk = ans.get("Risk", "UNANSWERED")
            risk_emoji = {"HIGH": "[HIGH]", "MEDIUM": "[MED]", "NONE": "[OK]"}.get(risk, "[?]")
            notes = ans.get("Notes", "").replace("\n", " ")[:50]
            report_lines.append(
                f"| {ans['QuestionTitle'][:60]} | {risk_emoji} | {notes} |"
            )

    # Improvement plan
    report_lines.extend([
        f"",
        f"## Improvement Plan",
        f"",
        f"### High Risk Items (Immediate Action Required)",
        f"",
    ])

    for pillar_id, pillar_name in pillars:
        improvements = wa.list_lens_review_improvements(
            WorkloadId=workload_id,
            LensAlias="wellarchitected",
            PillarId=pillar_id,
        )
        high_risk = [i for i in improvements["ImprovementSummaries"] if i.get("Risk") == "HIGH"]
        for item in high_risk:
            report_lines.append(
                f"- **[{pillar_name}]** {item['QuestionTitle']}: "
                f"{item.get('ImprovementPlanUrl', 'See AWS documentation')}"
            )

    # Write to file
    report_content = "\n".join(report_lines)
    with open(output_file, "w") as f:
        f.write(report_content)

    print(f"Report saved to {output_file}")
    print(f"Total risks: HIGH={risk_counts.get('HIGH', 0)}, MEDIUM={risk_counts.get('MEDIUM', 0)}")
    return report_content
```

---

## 4. Integration with Trusted Advisor

### 4.1 Mapping Trusted Advisor Categories to Well-Architected Pillars

```
┌──────────────────────────────────────────────────────────────────────┐
│  Trusted Advisor Category      │  Well-Architected Pillar           │
│──────────────────────────────────────────────────────────────────── │
│  Cost Optimization             │  Cost Optimization                  │
│  Performance                   │  Performance Efficiency             │
│  Security                      │  Security                           │
│  Fault Tolerance               │  Reliability                        │
│  Service Limits                │  Reliability (Foundations)          │
│  Operational Excellence (new)  │  Operational Excellence             │
└──────────────────────────────────────────────────────────────────────┘
```

```bash
# Get Trusted Advisor check results (requires Business/Enterprise Support)
aws support describe-trusted-advisor-checks \
  --language en \
  --query 'checks[*].{Id:id,Name:name,Category:category}' \
  --output table

# Get the result for a specific check
aws support describe-trusted-advisor-check-result \
  --check-id "Qch7DwouX1" \
  --query 'result.{Status:status,Flagged:flaggedResources|length(@)}'

# Summary of all checks
aws support describe-trusted-advisor-check-summaries \
  --check-ids $(aws support describe-trusted-advisor-checks \
    --language en \
    --query 'checks[*].id' --output text) \
  --query 'summaries[?status!=`ok`].{Check:checkId,Status:status,Flagged:flaggedResources.resourcesFlagged}'

# Refresh check results
aws support refresh-trusted-advisor-check --check-id "Qch7DwouX1"
```

```python
# Figure 7: Script to aggregate Trusted Advisor results by Well-Architected pillar
import boto3

def aggregate_trusted_advisor_by_pillar():
    """Aggregate Trusted Advisor results by Well-Architected pillar"""
    support = boto3.client("support", region_name="us-east-1")

    # Mapping from category to pillar
    category_to_pillar = {
        "cost_optimizing": "costOptimization",
        "performance": "performance",
        "security": "security",
        "fault_tolerance": "reliability",
        "service_limits": "reliability",
    }

    checks = support.describe_trusted_advisor_checks(language="en")["checks"]

    pillar_results = {
        "operationalExcellence": {"ok": 0, "warning": 0, "error": 0, "items": []},
        "security": {"ok": 0, "warning": 0, "error": 0, "items": []},
        "reliability": {"ok": 0, "warning": 0, "error": 0, "items": []},
        "performance": {"ok": 0, "warning": 0, "error": 0, "items": []},
        "costOptimization": {"ok": 0, "warning": 0, "error": 0, "items": []},
    }

    for check in checks:
        pillar = category_to_pillar.get(check["category"], "operationalExcellence")

        try:
            result = support.describe_trusted_advisor_check_result(
                checkId=check["id"]
            )["result"]

            status = result["status"]
            flagged_count = len(result.get("flaggedResources", []))

            pillar_results[pillar][status] = pillar_results[pillar].get(status, 0) + 1

            if status in ("warning", "error"):
                pillar_results[pillar]["items"].append({
                    "check": check["name"],
                    "status": status,
                    "flagged": flagged_count,
                    "description": check.get("description", "")[:100],
                })
        except Exception:
            pass  # Check not available in the support plan

    # Report output
    print("=== Trusted Advisor → Well-Architected Mapping ===\n")
    for pillar, data in pillar_results.items():
        total = data["ok"] + data["warning"] + data["error"]
        if total > 0:
            score = data["ok"] / total * 100
            print(f"[{pillar}] Score: {score:.0f}% ({data['ok']}/{total} checks OK)")
            for item in data["items"]:
                indicator = "!!" if item["status"] == "error" else "!"
                print(f"  {indicator} {item['check']} ({item['flagged']} resources)")

    return pillar_results
```

---

## 5. Well-Architected Compliant Stack with CDK

### 5.1 Automatically Applying Well-Architected Best Practices with CDK

```typescript
// Figure 8: Well-Architected compliant foundation stack (CDK TypeScript)
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as backup from "aws-cdk-lib/aws-backup";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";

export interface WellArchitectedStackProps extends cdk.StackProps {
  environment: "production" | "staging" | "development";
  monthlyBudgetUsd: number;
  alertEmail: string;
}

export class WellArchitectedFoundationStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly alarmTopic: sns.ITopic;

  constructor(scope: Construct, id: string, props: WellArchitectedStackProps) {
    super(scope, id, props);

    // ============================================================
    // Pillar 1: Security — Centralized encryption key management
    // ============================================================
    const encryptionKey = new kms.Key(this, "EncryptionKey", {
      alias: `${props.environment}-master-key`,
      enableKeyRotation: true,           // Annual automatic rotation
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      description: "Master encryption key for all data-at-rest encryption",
    });

    // ============================================================
    // Pillar 2: Reliability — Multi-AZ VPC
    // ============================================================
    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 3,                          // 3-AZ redundant configuration
      natGateways: props.environment === "production" ? 3 : 1,
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: "Isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      flowLogs: {
        "VpcFlowLog": {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // ============================================================
    // Pillar 3: Operational Excellence — Alarm notifications
    // ============================================================
    this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: `${props.environment}-wa-alarms`,
      displayName: `[${props.environment.toUpperCase()}] Well-Architected Alarms`,
    });

    new sns.Subscription(this, "AlarmEmail", {
      topic: this.alarmTopic,
      protocol: sns.SubscriptionProtocol.EMAIL,
      endpoint: props.alertEmail,
    });

    // Monitor VPC NAT Gateway errors
    const natErrorAlarm = new cloudwatch.Alarm(this, "NatGatewayError", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/NATGateway",
        metricName: "ErrorPortAllocation",
        statistic: "Sum",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: "NAT Gateway port allocation errors detected",
    });
    natErrorAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic)
    );

    // ============================================================
    // Pillar 4: Reliability — Automated backups
    // ============================================================
    const backupPlan = new backup.BackupPlan(this, "BackupPlan", {
      backupPlanName: `${props.environment}-daily-backup`,
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: "DailyBackup",
          scheduleExpression: cdk.aws_events.Schedule.cron({
            hour: "3",
            minute: "0",
          }),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(2),
          deleteAfter: cdk.Duration.days(35),
          moveToColdStorageAfter: cdk.Duration.days(7),
        }),
        new backup.BackupPlanRule({
          ruleName: "MonthlyBackup",
          scheduleExpression: cdk.aws_events.Schedule.cron({
            day: "1",
            hour: "3",
            minute: "0",
          }),
          deleteAfter: cdk.Duration.days(365),
          moveToColdStorageAfter: cdk.Duration.days(30),
        }),
      ],
    });

    // Select backup targets by tag
    backupPlan.addSelection("TaggedResources", {
      resources: [
        backup.BackupResource.fromTag("backup", "true"),
      ],
    });

    // ============================================================
    // Pillar 5: Cost Optimization — Budget alerts
    // ============================================================
    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: `${props.environment}-monthly-budget`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: props.monthlyBudgetUsd,
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 80,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            { subscriptionType: "EMAIL", address: props.alertEmail },
          ],
        },
        {
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            { subscriptionType: "EMAIL", address: props.alertEmail },
          ],
        },
      ],
    });

    // ============================================================
    // Tagging (best practice common to all pillars)
    // ============================================================
    cdk.Tags.of(this).add("Environment", props.environment);
    cdk.Tags.of(this).add("ManagedBy", "CDK");
    cdk.Tags.of(this).add("WellArchitected", "true");
    cdk.Tags.of(this).add("backup", "true");

    // ============================================================
    // Outputs
    // ============================================================
    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, "AlarmTopicArn", { value: this.alarmTopic.topicArn });
    new cdk.CfnOutput(this, "KmsKeyArn", { value: encryptionKey.keyArn });
  }
}
```

### 5.2 Automated Well-Architected Checks via CloudFormation (Config Rules)

```yaml
# Figure 9: Automated Well-Architected best practice checks (Config Rules)
AWSTemplateFormatVersion: "2010-09-09"
Description: "Well-Architected compliance checks via AWS Config"

Parameters:
  AlertEmail:
    Type: String
    Description: Email for compliance alerts

Resources:
  # === Compliance notifications ===
  ComplianceTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: wa-compliance-alerts
      Subscription:
        - Protocol: email
          Endpoint: !Ref AlertEmail

  # === Security pillar ===

  # Check S3 bucket public access block
  S3PublicAccessCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: s3-bucket-public-access-prohibited
      Source:
        Owner: AWS
        SourceIdentifier: S3_BUCKET_PUBLIC_READ_PROHIBITED

  # Detect unencrypted EBS volumes
  EbsEncryptionCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: ebs-encryption-by-default
      Source:
        Owner: AWS
        SourceIdentifier: EC2_EBS_ENCRYPTION_BY_DEFAULT

  # S3 buckets without MFA delete enabled
  S3MfaDeleteCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: s3-bucket-versioning-enabled
      Source:
        Owner: AWS
        SourceIdentifier: S3_BUCKET_VERSIONING_ENABLED

  # Check root account MFA
  RootMfaCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: root-account-mfa-enabled
      Source:
        Owner: AWS
        SourceIdentifier: ROOT_ACCOUNT_MFA_ENABLED

  # === Reliability pillar ===

  # Check RDS Multi-AZ
  RdsMultiAzCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: rds-multi-az-support
      Source:
        Owner: AWS
        SourceIdentifier: RDS_MULTI_AZ_SUPPORT

  # Check RDS automatic backups
  RdsBackupCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: rds-automatic-backup-enabled
      Source:
        Owner: AWS
        SourceIdentifier: DB_INSTANCE_BACKUP_ENABLED
      InputParameters:
        backupRetentionMinimum: "7"

  # Check ELB Cross-Zone Load Balancing
  ElbCrossZoneCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: elb-cross-zone-load-balancing
      Source:
        Owner: AWS
        SourceIdentifier: ELB_CROSS_ZONE_LOAD_BALANCING_ENABLED

  # === Cost Optimization pillar ===

  # Detect unused EIPs
  UnusedEipCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: eip-attached
      Source:
        Owner: AWS
        SourceIdentifier: EIP_ATTACHED

  # Detect unused EBS volumes
  UnusedEbsCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: ec2-volume-inuse-check
      Source:
        Owner: AWS
        SourceIdentifier: EC2_VOLUME_INUSE_CHECK

  # === Operational Excellence pillar ===

  # Check CloudTrail is enabled
  CloudTrailEnabledCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cloudtrail-enabled
      Source:
        Owner: AWS
        SourceIdentifier: CLOUD_TRAIL_ENABLED

  # Check CloudWatch log retention period
  CloudWatchLogRetentionCheck:
    Type: AWS::Config::ConfigRule
    Properties:
      ConfigRuleName: cw-loggroup-retention-period-check
      Source:
        Owner: AWS
        SourceIdentifier: CW_LOGGROUP_RETENTION_PERIOD_CHECK
      InputParameters:
        MinRetentionTime: "90"

  # === Automated notification on compliance change ===
  ComplianceChangeRule:
    Type: AWS::Events::Rule
    Properties:
      Name: wa-compliance-change
      EventPattern:
        source:
          - aws.config
        detail-type:
          - Config Rules Compliance Change
        detail:
          newEvaluationResult:
            complianceType:
              - NON_COMPLIANT
      Targets:
        - Arn: !Ref ComplianceTopic
          Id: ComplianceNotification

  ComplianceTopicPolicy:
    Type: AWS::SNS::TopicPolicy
    Properties:
      Topics:
        - !Ref ComplianceTopic
      PolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: events.amazonaws.com
            Action: sns:Publish
            Resource: !Ref ComplianceTopic

Outputs:
  ComplianceTopicArn:
    Value: !Ref ComplianceTopic
    Description: SNS topic for compliance alerts
```

---

## 6. Well-Architected Review Automation Pipeline

### 6.1 Integration with CI/CD Pipelines

```python
# Figure 10: Review automation with GitHub Actions / CodePipeline
import boto3
import json
import sys

def ci_well_architected_gate(workload_id: str, max_high_risk: int = 0):
    """Run a Well-Architected check as a CI/CD pipeline gate

    Blocks deployment if High Risk items exceed the threshold
    """
    wa = boto3.client("wellarchitected", region_name="ap-northeast-1")

    review = wa.get_lens_review(
        WorkloadId=workload_id,
        LensAlias="wellarchitected",
    )["LensReview"]

    risk_counts = review.get("RiskCounts", {})
    high_risk = risk_counts.get("HIGH", 0)
    medium_risk = risk_counts.get("MEDIUM", 0)
    unanswered = risk_counts.get("UNANSWERED", 0)

    print(f"=== Well-Architected Gate Check ===")
    print(f"Workload: {workload_id}")
    print(f"HIGH: {high_risk}, MEDIUM: {medium_risk}, UNANSWERED: {unanswered}")

    # Get High Risk details
    if high_risk > 0:
        print(f"\n--- High Risk Details ---")
        pillars = ["operationalExcellence", "security", "reliability",
                    "performance", "costOptimization", "sustainability"]
        for pillar in pillars:
            improvements = wa.list_lens_review_improvements(
                WorkloadId=workload_id,
                LensAlias="wellarchitected",
                PillarId=pillar,
            )
            for item in improvements["ImprovementSummaries"]:
                if item.get("Risk") == "HIGH":
                    print(f"  [{pillar}] {item['QuestionTitle']}")

    # Gate decision
    if high_risk > max_high_risk:
        print(f"\n❌ GATE FAILED: {high_risk} high risk items (max: {max_high_risk})")
        sys.exit(1)
    else:
        print(f"\n✅ GATE PASSED: {high_risk} high risk items within threshold")
        return True
```

```yaml
# Example pipeline integration with GitHub Actions
# .github/workflows/well-architected-gate.yml
name: Well-Architected Gate

on:
  pull_request:
    branches: [main]
    paths:
      - 'infrastructure/**'
      - 'cdk/**'

jobs:
  wa-check:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-wa-check
          aws-region: ap-northeast-1

      - name: Well-Architected Gate Check
        run: |
          python3 -c "
          import boto3
          wa = boto3.client('wellarchitected')
          review = wa.get_lens_review(
              WorkloadId='${{ vars.WA_WORKLOAD_ID }}',
              LensAlias='wellarchitected',
          )['LensReview']
          risk = review.get('RiskCounts', {})
          high = risk.get('HIGH', 0)
          print(f'High Risk: {high}')
          if high > 0:
              print('::error::Well-Architected review has HIGH risk items')
              exit(1)
          "
```

---

## 7. Comparison Tables

### 7.1 Overview Comparison of the 6 Pillars

| Pillar | Focus | Key AWS Services | Example KPIs |
|----|------|------------------|--------|
| **Operational Excellence** | Automate operations and continuously improve | CloudFormation, Systems Manager, CloudWatch | Deployment frequency, MTTR |
| **Security** | Protect data and assets | IAM, KMS, GuardDuty, Security Hub | Number of unresolved findings |
| **Reliability** | Disaster recovery and availability | Route 53, ELB, Auto Scaling, Backup | Availability %, RTO/RPO |
| **Performance Efficiency** | Efficient use of resources | CloudFront, ElastiCache, Lambda | Latency P99 |
| **Cost Optimization** | Eliminate waste and maximize value | Cost Explorer, Budgets, Savings Plans | Monthly cost, SP coverage rate |
| **Sustainability** | Minimize environmental impact | Graviton, Spot, Serverless | Estimated CO2 emissions |

### 7.2 Review Method Comparison

| Method | Audience | Time Required | Cost | Recommended When |
|------|------|---------|--------|---------|
| **Self-review** | Own team | 2-5 days | Free | Regular reviews |
| **AWS SA Review** | SA-assisted | 1-2 weeks | Free (Enterprise Support) | Initial review |
| **Partner Review** | APN partner | 2-4 weeks | Paid | Large-scale workloads |
| **AWS Well-Architected Tool** | Tool-assisted | 1-3 days | Free | Recommended for all cases |

### 7.3 Lens Comparison

| Lens | Target Workload | Additional Pillars | Approx. Questions | Recommended When |
|------|----------------|---------|-------------|---------|
| **Well-Architected (Standard)** | General | None | ~58 | All workloads |
| **Serverless** | Lambda, API GW, DynamoDB | None | ~30 | Serverless apps |
| **SaaS** | Multi-tenant SaaS | Tenant isolation | ~40 | SaaS providers |
| **Machine Learning** | ML workloads | ML lifecycle | ~35 | ML/AI apps |
| **Data Analytics** | Data analytics platforms | Data quality | ~30 | Data lakes, ETL |
| **Container** | ECS, EKS | Container operations | ~25 | Container workloads |
| **IoT** | IoT device management | Device management | ~30 | IoT platforms |
| **FTR (Foundational Technical Review)** | APN partners | None | ~50 | Partner certification |
| **Custom Lens** | Internal standards | Any | Any | Enforcing internal standards |

### 7.4 Well-Architected vs. Other Frameworks

| Item | AWS Well-Architected | TOGAF | ITIL | ISO 27001 |
|------|---------------------|-------|------|-----------|
| **Focus** | Cloud architecture | Entire enterprise | IT service management | Information security |
| **Scope** | AWS workloads | Cross-organizational | IT operational processes | Security management |
| **Tools** | WA Tool (free) | Commercial tools | Commercial tools | Certification bodies |
| **Update Frequency** | Ongoing (as AWS adds services) | Every few years | Every few years | Periodic revision |
| **Cost** | Free | License fees | Training costs | Certification costs |
| **Certification/Qualifications** | None (self-assessment) | TOGAF certified | ITIL certified | ISO certified |
| **Cloud Support** | AWS native | Cloud-agnostic | Cloud-agnostic | Cloud-agnostic |
| **Complementary Relationship** | - | Overall design → detail with WA | Complements operational processes | Adds detail to Security pillar |

---

## 8. Anti-Patterns

### 8.1 Treating the Review as a One-Time Event

```
BAD:
  Conduct a Well-Architected review before release
  → Mark as "complete" and shelve
  → 1 year later: architecture has changed, risks have returned

GOOD:
  Quarterly review cycle
  ┌──────────────────────────────────┐
  │  Q1: Full review                 │
  │  Q2: Verify High Risk improvements│
  │  Q3: Full review (re-assessment) │
  │  Q4: Annual retrospective + next │
  │      year planning               │
  └──────────────────────────────────┘
```

### 8.2 Treating All Pillars Equally

```
BAD:
  6 pillars × equal resource allocation
  → Critical security issues are deprioritized

GOOD:
  Risk-based prioritization
  1. Security High Risk → Immediate action (1-2 weeks)
  2. Reliability High Risk → Next sprint
  3. Operations Medium Risk → Backlog
  4. Cost/Performance → Quarterly planning
```

### 8.3 Treating It as a Formality

```
BAD:
  - Select "yes" for all questions to formally complete the review
  - Close all risks as "accepted"
  - Results are known only to the person in charge, not shared

GOOD:
  - Attach evidence (configuration screenshots, IaC code) for each question
  - Risk acceptance requires management approval
  - Share review results with the entire team for transparent improvement

  Evidence example:
  ┌────────────────────────────────────────────────────┐
  │ Question: Is data encrypted?                        │
  │                                                    │
  │ Answer: Yes                                        │
  │                                                    │
  │ Evidence:                                          │
  │ - RDS: storage_encrypted=true (CDK code L.142)     │
  │ - S3: BucketEncryption SSE-KMS (CDK code L.87)     │
  │ - EBS: encrypted=true (default setting ON)         │
  │ - DynamoDB: SSE-KMS (CDK code L.203)               │
  │ - Config Rule: encrypted-volumes COMPLIANT         │
  └────────────────────────────────────────────────────┘
```

### 8.4 Deferring Cost Optimization

```
BAD:
  Development complete → Production launch → "Costs are high" realized
  → Cost optimization project finally starts 6 months later
  → Tens of thousands of dollars already wasted

GOOD:
  Incorporate cost optimization from the design stage
  ┌────────────────────────────────────────────────────┐
  │ Cost optimization to implement from Day 1:          │
  │                                                    │
  │ 1. Design and apply cost allocation tags           │
  │ 2. Configure AWS Budgets (80%/100% alerts)         │
  │ 3. Enable Cost Anomaly Detection                   │
  │ 4. Schedule auto-stop for development environments │
  │ 5. Configure S3 lifecycle policies                 │
  │ 6. Enable Compute Optimizer                        │
  └────────────────────────────────────────────────────┘
```

### 8.5 Focusing on Only One Pillar

```
BAD:
  Security team leads the review
  → Only the Security pillar is reviewed in detail
  → Reliability and Performance risks are overlooked
  → Unable to recover when an outage occurs

GOOD:
  Cross-functional team reviews all pillars
  ┌────────────────────────────────────────┐
  │ Review team composition:               │
  │                                        │
  │ - Tech Lead (Operational Excellence)   │
  │ - Security Engineer (Security)         │
  │ - SRE (Reliability)                   │
  │ - Backend Engineer (Performance)       │
  │ - FinOps (Cost Optimization)           │
  │ - Architect (Sustainability + overall) │
  └────────────────────────────────────────┘
```

---

## 9. FAQ

### Q1. Who should lead the Well-Architected Review?

**A.** The tech lead or architect for the workload should lead the review, with participation from development, operations, and security team members. Asking an AWS Solutions Architect to assist with the initial review is efficient. If you have an Enterprise Support contract, you can receive SA assistance for free.

### Q2. Is Well-Architected necessary for small startups?

**A.** It is useful regardless of scale. However, you do not need to perfectly address every question. A realistic approach is to first focus on Security and Reliability High Risk items, then strengthen the other pillars as the business grows.

### Q3. Are Well-Architected Tool results shared with AWS?

**A.** They are not shared by default. The results are only accessible to your assigned SA if you explicitly enable "Share workload with AWS Solutions Architect." Data is encrypted and the account owner retains control.

### Q4. How do you conduct reviews in a multi-account environment?

**A.** Use the Well-Architected Tool in the Organizations management account or a dedicated architecture account, and register each member account's workloads individually. Review common infrastructure (VPC, IAM, log aggregation) as one workload and applications as separate workloads. You can also use AWS RAM (Resource Access Manager) to share review results across accounts.

### Q5. What are the benefits of creating a custom lens?

**A.** You can formalize your company's unique compliance requirements, industry regulations (PCI DSS, HIPAA, etc.), and internal architecture standards as a framework. This allows you to systematically review requirements that the standard Well-Architected Lens does not cover, and maintain consistent architecture quality across the organization. Define the lens in JSON format and import it using the AWS CLI.

```bash
# Example of creating a custom lens
aws wellarchitected import-lens \
  --json-string file://custom-lens.json \
  --tags Department=Engineering,Standard=InternalV2

# Publish the custom lens (share within the organization)
aws wellarchitected create-lens-share \
  --lens-alias "arn:aws:wellarchitected:ap-northeast-1:123456789012:lens/my-custom-lens" \
  --shared-with "arn:aws:organizations::123456789012:organization/o-abc123"
```

### Q6. How far can review automation be taken?

**A.** Using the Well-Architected Tool API, you can fully automate workload creation, answering questions, creating milestones, and retrieving reports. However, since answering questions requires technical judgment, automated answers are not recommended. The practical approach is as follows:

- **Automate**: Workload creation, milestone creation, report generation, Slack/Teams notifications
- **Semi-automate**: Suggest answers based on Config Rules / Security Hub results
- **Keep manual**: Final answer decisions, improvement plan formulation, prioritization

### Q7. What is the relationship between Well-Architected reviews and SOC 2 / ISO 27001 audits?

**A.** Well-Architected reviews are a self-assessment framework, not an audit or certification. However, the best practices in the Security pillar overlap significantly with SOC 2 and ISO 27001 requirements. By conducting Well-Architected reviews regularly and recording evidence, you can significantly reduce preparation effort for audits. The following areas in particular overlap:

| Well-Architected | SOC 2 | ISO 27001 |
|-----------------|-------|-----------|
| IAM / MFA | CC6.1 Logical access | A.9 Access control |
| Encryption | CC6.7 Encryption | A.10 Cryptography |
| Logging / Audit trail | CC7.2 Monitoring | A.12.4 Logging |
| Backup / DR | A1.2 Business continuity | A.17 Business continuity management |
| Incident response | CC7.3 Incident | A.16 Incident management |

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and confirming behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 10. Summary

| Item | Key Point |
|------|---------|
| **6 Pillars** | Operations, Security, Reliability, Performance, Cost, Sustainability |
| **Review Tool** | Use the AWS Well-Architected Tool to answer questions and visualize risks |
| **Priority** | Security > Reliability > Operations > Performance > Cost > Sustainability |
| **Continuity** | Quarterly periodic reviews, milestone-based progress tracking |
| **Lenses** | Use specialized lenses based on the type of workload |
| **Automation** | Config Rules + Security Hub + Trusted Advisor for continuous compliance |
| **CI/CD Integration** | Incorporate High Risk checks as a pipeline gate |
| **Evidence** | Record IaC code, configuration screenshots, and other evidence for each question |

---

## Next Guides to Read

- [00-cost-optimization.md](./00-cost-optimization.md) — Practical cost optimization
- Security Guide — Detailed design for IAM / KMS / WAF
- Reliability Guide — Multi-AZ / DR strategies

---

## References

1. **AWS Official Documentation** — "AWS Well-Architected Framework" — https://docs.aws.amazon.com/wellarchitected/latest/framework/
2. **AWS Official Documentation** — "AWS Well-Architected Tool User Guide" — https://docs.aws.amazon.com/wellarchitected/latest/userguide/
3. **AWS Official Whitepaper** — "AWS Well-Architected Framework: Six Pillars" — https://aws.amazon.com/architecture/well-architected/
4. **AWS Official Blog** — "Well-Architected Labs" — https://www.wellarchitectedlabs.com/
5. **AWS Official Documentation** — "Operational Excellence Pillar" — https://docs.aws.amazon.com/wellarchitected/latest/operational-excellence-pillar/
6. **AWS Official Documentation** — "Security Pillar" — https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/
7. **AWS Official Documentation** — "Reliability Pillar" — https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/
8. **AWS Official Documentation** — "Performance Efficiency Pillar" — https://docs.aws.amazon.com/wellarchitected/latest/performance-efficiency-pillar/
9. **AWS Official Documentation** — "Cost Optimization Pillar" — https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/
10. **AWS Official Documentation** — "Sustainability Pillar" — https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/
