# Cost Optimization — Cost Explorer / Budgets / Savings Plans

> A practical guide for visualizing, forecasting, and reducing AWS costs. Identify wasteful spending and achieve up to 72% cost savings with Savings Plans and Reserved Instances.

---

## What You Will Learn

1. Cost analysis and trend tracking with **Cost Explorer**
2. Alerts and automated actions with **AWS Budgets**
3. Long-term commitment discounts with **Savings Plans / Reserved Instances**
4. Detailed analysis with **Cost & Usage Report (CUR)**
5. Right-sizing with **Compute Optimizer**
6. Unused resource detection with **Trusted Advisor**
7. Building an **organizational cost optimization culture**


## Prerequisites

The following knowledge will help you understand this guide more deeply:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. Overall Cost Optimization Framework

### 1.1 Four Steps

```
┌──────────────────────────────────────────────────────┐
│           AWS Cost Optimization Framework             │
│                                                      │
│  Step 1: See (Visualize)                             │
│  ┌──────────────────────────────────────┐            │
│  │ Cost Explorer / Cost & Usage Report  │            │
│  │ → Understand where money is spent    │            │
│  └──────────────────────┬───────────────┘            │
│                         ▼                            │
│  Step 2: Analyze                                     │
│  ┌──────────────────────────────────────┐            │
│  │ Trusted Advisor / Compute Optimizer  │            │
│  │ → Identify wasteful resources        │            │
│  └──────────────────────┬───────────────┘            │
│                         ▼                            │
│  Step 3: Optimize (Reduce)                           │
│  ┌──────────────────────────────────────┐            │
│  │ Right Sizing / Savings Plans / Spot  │            │
│  │ → Choose appropriate size and plan   │            │
│  └──────────────────────┬───────────────┘            │
│                         ▼                            │
│  Step 4: Monitor                                     │
│  ┌──────────────────────────────────────┐            │
│  │ Budgets / Anomaly Detection          │            │
│  │ → Continuous monitoring and anomaly detection │   │
│  └──────────────────────────────────────┘            │
└──────────────────────────────────────────────────────┘
```

### 1.2 Cost Allocation Tag Strategy

```
┌─────────────────────────────────────────────┐
│          Cost Allocation via Tags             │
│                                             │
│  Required Tags:                             │
│  ┌────────────────┬───────────────────┐     │
│  │ Tag Key        │ Example Values    │     │
│  ├────────────────┼───────────────────┤     │
│  │ Environment    │ prod/staging/dev  │     │
│  │ Project        │ myapp/api/data    │     │
│  │ Team           │ backend/frontend  │     │
│  │ CostCenter     │ CC-001/CC-002     │     │
│  └────────────────┴───────────────────┘     │
│                                             │
│  → Enable in Billing > Cost Allocation Tags │
│  → Available in Cost Explorer after 24h     │
└─────────────────────────────────────────────┘
```

### 1.3 Cost Optimization Maturity Model

An organization's commitment to cost optimization can be assessed using the following maturity levels.

```
┌──────────────────────────────────────────────────────────────┐
│           Cost Optimization Maturity Model                    │
│                                                              │
│  Level 1: Reactive                                           │
│  ├─ Costs only noticed when the end-of-month bill arrives    │
│  ├─ Tagging is incomplete, cost allocation not possible      │
│  └─ Cost reduction is ad-hoc and person-dependent           │
│                                                              │
│  Level 2: Visible                                            │
│  ├─ Cost Explorer reviewed regularly                         │
│  ├─ Tags applied to major projects                           │
│  └─ Monthly cost reports shared                              │
│                                                              │
│  Level 3: Proactive                                          │
│  ├─ Budgets + alerts configured for all environments         │
│  ├─ Strategic purchases of Savings Plans / RIs               │
│  ├─ Compute Optimizer recommendations applied regularly      │
│  └─ Cost anomaly detection is automated                      │
│                                                              │
│  Level 4: Optimized                                          │
│  ├─ FinOps team / Cloud COE exists                          │
│  ├─ Custom analytics platform with CUR + Athena + QuickSight │
│  ├─ Per-team cost budgets and KPIs defined                   │
│  └─ Cost efficiency quantitatively evaluated at design time  │
│                                                              │
│  Level 5: Value-Driven                                       │
│  ├─ Unit economics tracked (e.g., cost per user)             │
│  ├─ Cost efficiency managed as a business KPI at exec level  │
│  └─ Automated cost optimization pipeline                     │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 FinOps Principles

The following are the practical principles of FinOps (Cloud Financial Management).

```yaml
# The 6 Principles of FinOps
finops_principles:
  - name: "Team Collaboration"
    description: "Finance, engineering, and business teams collaborate to manage costs"
    actions:
      - "Hold monthly FinOps review meetings"
      - "Assign a cost owner to each team"
      - "Make cost information transparent to all teams"

  - name: "Business Value-Based Decision Making"
    description: "Focus on balance between cost reduction and business value, not just cuts"
    actions:
      - "Define unit economics (e.g., cost per transaction)"
      - "Calculate ROI of cost optimizations before executing"

  - name: "Leverage the Variable Cost Model of the Cloud"
    description: "Maximize the flexibility of on-demand usage"
    actions:
      - "Turn dev environments into variable costs with scheduled shutdowns"
      - "Use Spot Instances for burst demand"

  - name: "Everyone Is a Cost Owner"
    description: "Culture where every engineer has cost awareness"
    actions:
      - "Review cost impact during PR reviews"
      - "Share cost dashboards with all team members"
      - "Process for immediately reporting detected cost anomalies"

  - name: "Timely Reporting"
    description: "Provide near-real-time cost information"
    actions:
      - "Automatically send daily cost reports"
      - "Notify anomaly detection alerts in real time"

  - name: "Centralized Governance, Distributed Execution"
    description: "Governance is centralized; optimization is executed by each team"
    actions:
      - "Define company-wide tagging policies"
      - "Purchase Savings Plans centrally; resource optimization is per team"
```

---

## 2. Cost Explorer

### 2.1 Cost Analysis via CLI

```bash
# Get monthly service costs (last 3 months)
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-03-01 \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output json | jq '.ResultsByTime[] | {
    period: .TimePeriod,
    costs: [.Groups[] | select(.Metrics.BlendedCost.Amount | tonumber > 10) | {
      service: .Keys[0],
      cost: .Metrics.BlendedCost.Amount
    }]
  }'

# Cost analysis by tag
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --group-by Type=TAG,Key=Project \
  --filter '{
    "Tags": {
      "Key": "Environment",
      "Values": ["prod"],
      "MatchOptions": ["EQUALS"]
    }
  }'

# Daily cost retrieval (last 7 days)
START_DATE=$(date -d "7 days ago" +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)
END_DATE=$(date +%Y-%m-%d)
aws ce get-cost-and-usage \
  --time-period Start=${START_DATE},End=${END_DATE} \
  --granularity DAILY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output json | jq '[.ResultsByTime[] | {
    date: .TimePeriod.Start,
    total: ([.Groups[].Metrics.UnblendedCost.Amount | tonumber] | add | . * 100 | round / 100),
    top_services: [.Groups | sort_by(-.Metrics.UnblendedCost.Amount | tonumber) | .[:5][] | {
      service: .Keys[0],
      cost: (.Metrics.UnblendedCost.Amount | tonumber | . * 100 | round / 100)
    }]
  }]'

# Cost analysis by region
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=REGION \
  --output json | jq '.ResultsByTime[0].Groups | sort_by(-.Metrics.BlendedCost.Amount | tonumber) | .[] | {
    region: .Keys[0],
    cost_usd: (.Metrics.BlendedCost.Amount | tonumber | . * 100 | round / 100)
  }'

# Cost analysis by usage type (e.g., data transfer)
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --metrics "BlendedCost" "UsageQuantity" \
  --filter '{
    "Dimensions": {
      "Key": "SERVICE",
      "Values": ["Amazon Elastic Compute Cloud - Compute"]
    }
  }' \
  --group-by Type=DIMENSION,Key=USAGE_TYPE
```

### 2.2 Automating Cost Analysis with Python

```python
import boto3
from datetime import datetime, timedelta
from typing import Optional
import json


def get_monthly_cost_by_service(months: int = 3) -> list[dict]:
    """Get monthly costs by service"""
    client = boto3.client("ce", region_name="us-east-1")

    end = datetime.now().replace(day=1)
    start = (end - timedelta(days=months * 30)).replace(day=1)

    response = client.get_cost_and_usage(
        TimePeriod={
            "Start": start.strftime("%Y-%m-%d"),
            "End": end.strftime("%Y-%m-%d"),
        },
        Granularity="MONTHLY",
        Metrics=["BlendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    results = []
    for period in response["ResultsByTime"]:
        month = period["TimePeriod"]["Start"]
        for group in period["Groups"]:
            cost = float(group["Metrics"]["BlendedCost"]["Amount"])
            if cost > 1.0:  # Only services costing more than $1
                results.append({
                    "month": month,
                    "service": group["Keys"][0],
                    "cost_usd": round(cost, 2),
                })
    return results


def get_cost_forecast(days: int = 30) -> dict:
    """Get cost forecast"""
    client = boto3.client("ce", region_name="us-east-1")

    start = datetime.now().strftime("%Y-%m-%d")
    end = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")

    response = client.get_cost_forecast(
        TimePeriod={"Start": start, "End": end},
        Metric="BLENDED_COST",
        Granularity="MONTHLY",
    )

    return {
        "forecast_usd": float(response["Total"]["Amount"]),
        "confidence_80_low": float(response["Total"].get("Amount", 0)),
    }


def get_cost_by_tag(
    tag_key: str,
    months: int = 1,
    environment: Optional[str] = None,
) -> list[dict]:
    """Cost analysis by tag"""
    client = boto3.client("ce", region_name="us-east-1")

    end = datetime.now().replace(day=1)
    start = (end - timedelta(days=months * 30)).replace(day=1)

    params = {
        "TimePeriod": {
            "Start": start.strftime("%Y-%m-%d"),
            "End": end.strftime("%Y-%m-%d"),
        },
        "Granularity": "MONTHLY",
        "Metrics": ["BlendedCost", "UnblendedCost"],
        "GroupBy": [{"Type": "TAG", "Key": tag_key}],
    }

    if environment:
        params["Filter"] = {
            "Tags": {
                "Key": "Environment",
                "Values": [environment],
                "MatchOptions": ["EQUALS"],
            }
        }

    response = client.get_cost_and_usage(**params)

    results = []
    for period in response["ResultsByTime"]:
        month = period["TimePeriod"]["Start"]
        for group in period["Groups"]:
            tag_value = group["Keys"][0]
            if tag_value.startswith(f"{tag_key}$"):
                tag_value = tag_value.split("$", 1)[1]
            blended = float(group["Metrics"]["BlendedCost"]["Amount"])
            unblended = float(group["Metrics"]["UnblendedCost"]["Amount"])
            if blended > 0.01:
                results.append({
                    "month": month,
                    "tag_value": tag_value or "(untagged)",
                    "blended_cost": round(blended, 2),
                    "unblended_cost": round(unblended, 2),
                })
    return results


def get_daily_cost_trend(days: int = 30) -> list[dict]:
    """Get daily cost trend"""
    client = boto3.client("ce", region_name="us-east-1")

    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    response = client.get_cost_and_usage(
        TimePeriod={"Start": start, "End": end},
        Granularity="DAILY",
        Metrics=["UnblendedCost"],
    )

    results = []
    for period in response["ResultsByTime"]:
        date = period["TimePeriod"]["Start"]
        cost = float(period["Total"]["UnblendedCost"]["Amount"])
        results.append({
            "date": date,
            "cost_usd": round(cost, 2),
        })
    return results


def get_top_cost_services(
    months: int = 1,
    top_n: int = 10,
) -> list[dict]:
    """Get top N services by cost"""
    client = boto3.client("ce", region_name="us-east-1")

    end = datetime.now().replace(day=1)
    start = (end - timedelta(days=months * 30)).replace(day=1)

    response = client.get_cost_and_usage(
        TimePeriod={
            "Start": start.strftime("%Y-%m-%d"),
            "End": end.strftime("%Y-%m-%d"),
        },
        Granularity="MONTHLY",
        Metrics=["UnblendedCost"],
        GroupBy=[{"Type": "DIMENSION", "Key": "SERVICE"}],
    )

    services = []
    for period in response["ResultsByTime"]:
        for group in period["Groups"]:
            cost = float(group["Metrics"]["UnblendedCost"]["Amount"])
            services.append({
                "service": group["Keys"][0],
                "cost_usd": round(cost, 2),
            })

    services.sort(key=lambda x: x["cost_usd"], reverse=True)
    total = sum(s["cost_usd"] for s in services)

    # Calculate percentage
    for svc in services[:top_n]:
        svc["percentage"] = round(svc["cost_usd"] / total * 100, 1) if total > 0 else 0

    return services[:top_n]


def generate_cost_report(months: int = 3) -> str:
    """Generate a cost report and return it in Markdown format"""
    report_lines = ["# AWS Monthly Cost Report\n"]
    report_lines.append(f"Report generated at: {datetime.now().isoformat()}\n")

    # Cost by service
    report_lines.append("## Cost by Service\n")
    costs = get_monthly_cost_by_service(months)

    if costs:
        months_set = sorted(set(c["month"] for c in costs))
        report_lines.append("| Service | " + " | ".join(months_set) + " |")
        report_lines.append("|" + "---|" * (len(months_set) + 1))

        services = sorted(set(c["service"] for c in costs))
        for svc in services:
            row = f"| {svc} "
            for month in months_set:
                matching = [c for c in costs if c["service"] == svc and c["month"] == month]
                if matching:
                    row += f"| ${matching[0]['cost_usd']:,.2f} "
                else:
                    row += "| - "
            row += "|"
            report_lines.append(row)

    # Cost forecast
    report_lines.append("\n## Cost Forecast\n")
    try:
        forecast = get_cost_forecast()
        report_lines.append(f"- Forecasted cost for next 30 days: **${forecast['forecast_usd']:,.2f}**")
    except Exception as e:
        report_lines.append(f"- Forecast retrieval error: {e}")

    # Top services
    report_lines.append("\n## Top Cost Services\n")
    top_services = get_top_cost_services()
    report_lines.append("| # | Service | Cost | Percentage |")
    report_lines.append("|---|---------|------|------------|")
    for i, svc in enumerate(top_services, 1):
        report_lines.append(
            f"| {i} | {svc['service']} | ${svc['cost_usd']:,.2f} | {svc.get('percentage', 0)}% |"
        )

    return "\n".join(report_lines)
```

### 2.3 Cost Anomaly Detection

```bash
# Create an anomaly detection monitor
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "ServiceMonitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'

# Create a notification subscription
aws ce create-anomaly-subscription \
  --anomaly-subscription '{
    "SubscriptionName": "CostAnomalyAlert",
    "MonitorArnList": ["arn:aws:ce::123456789012:anomalymonitor/monitor-id"],
    "Subscribers": [
      {
        "Address": "team@example.com",
        "Type": "EMAIL"
      }
    ],
    "Threshold": 100,
    "Frequency": "DAILY"
  }'

# Tag-based anomaly detection monitor (per project)
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "ProjectCostMonitor",
    "MonitorType": "CUSTOM",
    "MonitorSpecification": {
      "Tags": {
        "Key": "Project",
        "Values": ["myapp", "api-service", "data-pipeline"],
        "MatchOptions": ["EQUALS"]
      }
    }
  }'

# Retrieve anomaly detection results
aws ce get-anomalies \
  --date-interval '{"StartDate": "2026-01-01", "EndDate": "2026-02-01"}' \
  --output json | jq '.Anomalies[] | {
    id: .AnomalyId,
    start: .AnomalyStartDate,
    end: .AnomalyEndDate,
    service: .DimensionValue,
    impact: .Impact.TotalImpact,
    expected: .Impact.TotalExpectedSpend,
    actual: .Impact.TotalActualSpend
  }'
```

### 2.4 Terraform Configuration for Cost Anomaly Detection

```hcl
# Anomaly detection monitor
resource "aws_ce_anomaly_monitor" "service_monitor" {
  name              = "service-cost-anomaly-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"

  tags = {
    Environment = "management"
    Purpose     = "cost-optimization"
  }
}

resource "aws_ce_anomaly_monitor" "project_monitor" {
  name         = "project-cost-anomaly-monitor"
  monitor_type = "CUSTOM"

  monitor_specification = jsonencode({
    Tags = {
      Key          = "Project"
      Values       = ["myapp", "api-service"]
      MatchOptions = ["EQUALS"]
    }
  })
}

# Anomaly detection subscription (SNS integration for Slack notifications)
resource "aws_ce_anomaly_subscription" "cost_alerts" {
  name = "cost-anomaly-alerts"

  monitor_arn_list = [
    aws_ce_anomaly_monitor.service_monitor.arn,
    aws_ce_anomaly_monitor.project_monitor.arn,
  ]

  subscriber {
    type    = "SNS"
    address = aws_sns_topic.cost_alerts.arn
  }

  # Notify only when impact is $50 or more
  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = ["50"]
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }

  frequency = "DAILY"
}

resource "aws_sns_topic" "cost_alerts" {
  name = "cost-anomaly-alerts"
}

# Lambda subscription for Slack integration
resource "aws_sns_topic_subscription" "slack_notification" {
  topic_arn = aws_sns_topic.cost_alerts.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.slack_notifier.arn
}
```

### 2.5 Lambda Function for Slack Notifications

```python
"""
Lambda function that sends Cost Anomaly Detection results to Slack.
Triggered via an SNS topic.
"""
import json
import os
import urllib.request
from datetime import datetime


SLACK_WEBHOOK_URL = os.environ["SLACK_WEBHOOK_URL"]
SLACK_CHANNEL = os.environ.get("SLACK_CHANNEL", "#cost-alerts")


def lambda_handler(event, context):
    """Forward Cost Anomaly notifications from SNS to Slack"""
    for record in event["Records"]:
        message = json.loads(record["Sns"]["Message"])

        anomaly_id = message.get("anomalyId", "N/A")
        start_date = message.get("anomalyStartDate", "N/A")
        end_date = message.get("anomalyEndDate", "N/A")
        service = message.get("dimensionValue", "N/A")

        impact = message.get("impact", {})
        total_impact = float(impact.get("totalImpact", 0))
        expected_spend = float(impact.get("totalExpectedSpend", 0))
        actual_spend = float(impact.get("totalActualSpend", 0))

        # Build Slack message
        color = "#ff0000" if total_impact > 100 else "#ffaa00"
        slack_message = {
            "channel": SLACK_CHANNEL,
            "username": "AWS Cost Anomaly Alert",
            "icon_emoji": ":money_with_wings:",
            "attachments": [
                {
                    "color": color,
                    "title": f"Cost Anomaly Detected: {service}",
                    "fields": [
                        {
                            "title": "Impact",
                            "value": f"${total_impact:,.2f}",
                            "short": True,
                        },
                        {
                            "title": "Period",
                            "value": f"{start_date} ~ {end_date}",
                            "short": True,
                        },
                        {
                            "title": "Expected Spend",
                            "value": f"${expected_spend:,.2f}",
                            "short": True,
                        },
                        {
                            "title": "Actual Spend",
                            "value": f"${actual_spend:,.2f}",
                            "short": True,
                        },
                    ],
                    "footer": f"Anomaly ID: {anomaly_id}",
                    "ts": int(datetime.now().timestamp()),
                }
            ],
        }

        req = urllib.request.Request(
            SLACK_WEBHOOK_URL,
            data=json.dumps(slack_message).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req)

    return {"statusCode": 200, "body": "Notification sent"}
```

---

## 3. AWS Budgets

### 3.1 Creating Budgets and Automated Actions

```bash
# Create a monthly budget ($1,000, alerts at 80% and 100%)
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "MonthlyBudget",
    "BudgetLimit": {
      "Amount": "1000",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {},
    "CostTypes": {
      "IncludeTax": true,
      "IncludeSubscription": true,
      "UseBlended": false
    }
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 80,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "team@example.com"
        }
      ]
    },
    {
      "Notification": {
        "NotificationType": "ACTUAL",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 100,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "SNS",
          "Address": "arn:aws:sns:ap-northeast-1:123456789012:budget-alerts"
        }
      ]
    }
  ]'

# Create a per-service budget (EC2 only)
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "EC2-MonthlyBudget",
    "BudgetLimit": {
      "Amount": "500",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {
      "Service": ["Amazon Elastic Compute Cloud - Compute"]
    },
    "CostTypes": {
      "IncludeTax": true,
      "IncludeSubscription": true,
      "UseBlended": false
    }
  }' \
  --notifications-with-subscribers '[
    {
      "Notification": {
        "NotificationType": "FORECASTED",
        "ComparisonOperator": "GREATER_THAN",
        "Threshold": 100,
        "ThresholdType": "PERCENTAGE"
      },
      "Subscribers": [
        {
          "SubscriptionType": "EMAIL",
          "Address": "team@example.com"
        }
      ]
    }
  ]'

# List all budgets
aws budgets describe-budgets \
  --account-id 123456789012 \
  --output json | jq '.Budgets[] | {
    name: .BudgetName,
    limit: .BudgetLimit,
    actual: .CalculatedSpend.ActualSpend,
    forecast: .CalculatedSpend.ForecastedSpend,
    time_unit: .TimeUnit
  }'
```

### 3.2 Budget Definition with Terraform

```hcl
resource "aws_budgets_budget" "monthly" {
  name         = "monthly-total-budget"
  budget_type  = "COST"
  limit_amount = "1000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Environment$prod"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["team@example.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}

# Automated action on budget overrun (stop EC2)
resource "aws_budgets_budget_action" "stop_ec2" {
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "RUN_SSM_DOCUMENTS"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 120
  }

  definition {
    ssm_action_definition {
      action_sub_type = "STOP_EC2_INSTANCES"
      instance_ids    = ["i-0123456789abcdef0"]
      region          = "ap-northeast-1"
    }
  }

  subscriber {
    address           = "team@example.com"
    subscription_type = "EMAIL"
  }
}

# Bulk definition of per-service budgets
variable "service_budgets" {
  type = map(object({
    limit_amount = string
    service_name = string
  }))
  default = {
    ec2 = {
      limit_amount = "500"
      service_name = "Amazon Elastic Compute Cloud - Compute"
    }
    rds = {
      limit_amount = "300"
      service_name = "Amazon Relational Database Service"
    }
    s3 = {
      limit_amount = "100"
      service_name = "Amazon Simple Storage Service"
    }
    lambda = {
      limit_amount = "50"
      service_name = "AWS Lambda"
    }
  }
}

resource "aws_budgets_budget" "service" {
  for_each = var.service_budgets

  name         = "${each.key}-monthly-budget"
  budget_type  = "COST"
  limit_amount = each.value.limit_amount
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = [each.value.service_name]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["team@example.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = ["team@example.com"]
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}

# Per-team budgets (tag-based)
variable "team_budgets" {
  type = map(string)
  default = {
    backend  = "2000"
    frontend = "500"
    data     = "1500"
    ml       = "3000"
  }
}

resource "aws_budgets_budget" "team" {
  for_each = var.team_budgets

  name         = "team-${each.key}-monthly-budget"
  budget_type  = "COST"
  limit_amount = each.value
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "TagKeyValue"
    values = ["user:Team$${each.key}"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["${each.key}-lead@example.com"]
  }
}
```

### 3.3 Automated Cost Control via Budget Actions

Build a mechanism to automatically control resources when budget limits are exceeded.

```python
"""
Script for configuring and managing Budget actions.
Automatically stops dev environment EC2 instances when budget is exceeded.
"""
import boto3
import json


def setup_budget_auto_action(
    account_id: str,
    budget_name: str,
    threshold_percentage: float = 100.0,
    target_instances: list[str] = None,
    region: str = "ap-northeast-1",
) -> dict:
    """Configure automated actions when budget is exceeded"""
    budgets_client = boto3.client("budgets", region_name="us-east-1")
    iam_client = boto3.client("iam")

    # Create IAM role for Budget Action
    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "budgets.amazonaws.com"
                },
                "Action": "sts:AssumeRole",
            }
        ],
    }

    role_name = f"BudgetAction-{budget_name}-Role"

    try:
        role = iam_client.create_role(
            RoleName=role_name,
            AssumeRolePolicyDocument=json.dumps(trust_policy),
            Description=f"Role for budget action: {budget_name}",
        )
    except iam_client.exceptions.EntityAlreadyExistsException:
        role = iam_client.get_role(RoleName=role_name)

    # Grant EC2 stop permissions
    ec2_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["ec2:StopInstances", "ec2:DescribeInstances"],
                "Resource": "*",
                "Condition": {
                    "StringEquals": {
                        "ec2:ResourceTag/Environment": "dev"
                    }
                },
            }
        ],
    }

    iam_client.put_role_policy(
        RoleName=role_name,
        PolicyName="StopDevEC2Instances",
        PolicyDocument=json.dumps(ec2_policy),
    )

    # Create Budget Action
    action = budgets_client.create_budget_action(
        AccountId=account_id,
        BudgetName=budget_name,
        NotificationType="ACTUAL",
        ActionType="RUN_SSM_DOCUMENTS",
        ActionThreshold={
            "ActionThresholdValue": threshold_percentage,
            "ActionThresholdType": "PERCENTAGE",
        },
        Definition={
            "SsmActionDefinition": {
                "ActionSubType": "STOP_EC2_INSTANCES",
                "Region": region,
                "InstanceIds": target_instances or [],
            }
        },
        ExecutionRoleArn=role["Role"]["Arn"],
        ApprovalModel="AUTOMATIC",
        Subscribers=[
            {
                "SubscriptionType": "EMAIL",
                "Address": "admin@example.com",
            }
        ],
    )

    return {
        "action_id": action["ActionId"],
        "budget_name": budget_name,
        "threshold": threshold_percentage,
        "role_arn": role["Role"]["Arn"],
    }
```

---

## 4. Savings Plans and Reserved Instances

### 4.1 Selection Flow

```
I want to reduce costs
     │
     ├─ EC2 only? Or other compute too?
     │     │
     │     ├─ EC2 only
     │     │     │
     │     │     ├─ Can fix instance family → EC2 Instance Savings Plans
     │     │     │                             (up to 72% discount)
     │     │     │
     │     │     └─ Can also fix region & OS → Reserved Instances
     │     │                                   (up to 72% discount)
     │     │
     │     └─ Includes Lambda/Fargate → Compute Savings Plans
     │                                  (up to 66% discount)
     │
     └─ Short-term workloads → Spot Instances (up to 90% discount)
                               * Interruption risk exists
```

### 4.2 Checking Savings Plans Purchase Recommendations

```bash
# Get Savings Plans purchase recommendations
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type "COMPUTE_SP" \
  --term-in-years "ONE_YEAR" \
  --payment-option "NO_UPFRONT" \
  --lookback-period-in-days "SIXTY_DAYS" \
  --output json | jq '{
    estimated_monthly_savings: .SavingsPlansPurchaseRecommendation.SavingsPlansPurchaseRecommendationSummary.EstimatedMonthlySavingsAmount,
    hourly_commitment: .SavingsPlansPurchaseRecommendation.SavingsPlansPurchaseRecommendationSummary.HourlyCommitmentToPurchase,
    coverage_percentage: .SavingsPlansPurchaseRecommendation.SavingsPlansPurchaseRecommendationSummary.CurrentOnDemandSpend
  }'

# Also check EC2 Instance Savings Plans recommendations
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type "EC2_INSTANCE_SP" \
  --term-in-years "ONE_YEAR" \
  --payment-option "PARTIAL_UPFRONT" \
  --lookback-period-in-days "SIXTY_DAYS"

# Check current Savings Plans coverage
aws ce get-savings-plans-coverage \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --output json | jq '.SavingsPlansCoverages[] | {
    period: .TimePeriod,
    coverage_percentage: .Coverage.CoveragePercentage,
    spend_covered: .Coverage.SpendCoveredBySavingsPlans,
    on_demand_cost: .Coverage.OnDemandCost
  }'

# Check Savings Plans utilization
aws ce get-savings-plans-utilization \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --output json | jq '.SavingsPlansUtilizationsByTime[] | {
    period: .TimePeriod,
    utilization: .Utilization.UtilizationPercentage,
    total_commitment: .Utilization.TotalCommitment,
    used_commitment: .Utilization.UsedCommitment,
    unused_commitment: .Utilization.UnusedCommitment
  }'
```

### 4.3 Developing a Savings Plans Purchase Strategy

```python
"""
Script to analyze Savings Plans purchase strategies.
Calculates optimal commitment amount from historical usage data.
"""
import boto3
from datetime import datetime, timedelta
from dataclasses import dataclass


@dataclass
class SavingsPlanRecommendation:
    """Savings Plans purchase recommendation"""
    sp_type: str
    term: str
    payment_option: str
    hourly_commitment: float
    estimated_monthly_savings: float
    estimated_savings_percentage: float
    roi_months: float


def analyze_savings_plan_options() -> list[SavingsPlanRecommendation]:
    """Compare and analyze different Savings Plans options"""
    client = boto3.client("ce", region_name="us-east-1")

    recommendations = []

    for sp_type in ["COMPUTE_SP", "EC2_INSTANCE_SP"]:
        for term in ["ONE_YEAR", "THREE_YEARS"]:
            for payment in ["NO_UPFRONT", "PARTIAL_UPFRONT", "ALL_UPFRONT"]:
                try:
                    response = client.get_savings_plans_purchase_recommendation(
                        SavingsPlansType=sp_type,
                        TermInYears=term,
                        PaymentOption=payment,
                        LookbackPeriodInDays="SIXTY_DAYS",
                    )

                    summary = response.get(
                        "SavingsPlansPurchaseRecommendation", {}
                    ).get("SavingsPlansPurchaseRecommendationSummary", {})

                    if summary:
                        monthly_savings = float(
                            summary.get("EstimatedMonthlySavingsAmount", 0)
                        )
                        hourly_commit = float(
                            summary.get("HourlyCommitmentToPurchase", 0)
                        )
                        savings_pct = float(
                            summary.get("EstimatedSavingsPercentage", 0)
                        )

                        # Calculate ROI (in months)
                        monthly_commitment = hourly_commit * 730  # avg hours per month
                        if payment == "ALL_UPFRONT":
                            term_months = 12 if term == "ONE_YEAR" else 36
                            upfront = monthly_commitment * term_months
                            total_savings = monthly_savings * term_months
                            roi_months = (
                                upfront / monthly_savings
                                if monthly_savings > 0
                                else float("inf")
                            )
                        else:
                            roi_months = 0  # Immediate ROI with no upfront

                        recommendations.append(
                            SavingsPlanRecommendation(
                                sp_type=sp_type,
                                term=term,
                                payment_option=payment,
                                hourly_commitment=hourly_commit,
                                estimated_monthly_savings=monthly_savings,
                                estimated_savings_percentage=savings_pct,
                                roi_months=roi_months,
                            )
                        )
                except Exception:
                    continue

    # Sort by monthly savings amount
    recommendations.sort(
        key=lambda r: r.estimated_monthly_savings, reverse=True
    )
    return recommendations


def calculate_optimal_commitment(
    safety_margin: float = 0.8,
) -> dict:
    """
    Calculate optimal commitment amount from historical usage data.
    safety_margin: what percentage of baseline to cover (default 80%)
    """
    client = boto3.client("ce", region_name="us-east-1")

    # Get daily costs for the past 90 days
    end = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")

    response = client.get_cost_and_usage(
        TimePeriod={"Start": start, "End": end},
        Granularity="DAILY",
        Metrics=["UnblendedCost"],
        Filter={
            "Dimensions": {
                "Key": "RECORD_TYPE",
                "Values": ["Usage"],
            }
        },
    )

    daily_costs = [
        float(period["Total"]["UnblendedCost"]["Amount"])
        for period in response["ResultsByTime"]
    ]

    if not daily_costs:
        return {"error": "No cost data available"}

    daily_costs.sort()

    # Percentile analysis
    p10 = daily_costs[int(len(daily_costs) * 0.1)]
    p25 = daily_costs[int(len(daily_costs) * 0.25)]
    p50 = daily_costs[int(len(daily_costs) * 0.5)]
    p75 = daily_costs[int(len(daily_costs) * 0.75)]
    p90 = daily_costs[int(len(daily_costs) * 0.9)]

    # Baseline = P25 (bottom 25% of daily costs)
    baseline_daily = p25
    recommended_hourly = (baseline_daily * safety_margin) / 24

    return {
        "analysis_period_days": len(daily_costs),
        "daily_cost_stats": {
            "min": round(min(daily_costs), 2),
            "p10": round(p10, 2),
            "p25_baseline": round(p25, 2),
            "p50_median": round(p50, 2),
            "p75": round(p75, 2),
            "p90": round(p90, 2),
            "max": round(max(daily_costs), 2),
            "average": round(sum(daily_costs) / len(daily_costs), 2),
        },
        "recommendation": {
            "safety_margin": safety_margin,
            "recommended_hourly_commitment": round(recommended_hourly, 2),
            "estimated_monthly_commitment": round(recommended_hourly * 730, 2),
            "coverage_percentage": round(
                (baseline_daily * safety_margin) / (sum(daily_costs) / len(daily_costs)) * 100, 1
            ),
        },
    }
```

### 4.4 Managing Reserved Instances

```bash
# View RI list and usage status
aws ec2 describe-reserved-instances \
  --filters Name=state,Values=active \
  --output json | jq '.ReservedInstances[] | {
    id: .ReservedInstancesId,
    type: .InstanceType,
    count: .InstanceCount,
    state: .State,
    offering: .OfferingType,
    start: .Start,
    end: .End,
    fixed_price: .FixedPrice,
    usage_price: .UsagePrice
  }'

# Check RI coverage
aws ce get-reservation-coverage \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --group-by Type=DIMENSION,Key=INSTANCE_TYPE \
  --output json | jq '.CoveragesByTime[0].Groups[] | select(.Coverage.CoverageHours.CoverageHoursPercentage | tonumber > 0) | {
    instance_type: .Attributes.instanceType,
    coverage_pct: .Coverage.CoverageHours.CoverageHoursPercentage,
    on_demand_hours: .Coverage.CoverageHours.OnDemandHours,
    reserved_hours: .Coverage.CoverageHours.ReservedNormalizedUnitsPercentage
  }'

# Check RI utilization
aws ce get-reservation-utilization \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --granularity MONTHLY \
  --output json | jq '.UtilizationsByTime[0].Total | {
    utilization_pct: .UtilizationPercentage,
    purchased_hours: .PurchasedHours,
    total_actual_hours: .TotalActualHours,
    unused_hours: .UnusedHours,
    net_savings: .NetRISavings,
    amortized_upfront: .AmortizedUpfrontFee
  }'

# Get RI purchase recommendations
aws ce get-reservation-purchase-recommendation \
  --service "Amazon Elastic Compute Cloud - Compute" \
  --term-in-years "ONE_YEAR" \
  --payment-option "PARTIAL_UPFRONT" \
  --lookback-period-in-days "SIXTY_DAYS"
```

### 4.5 Leveraging Spot Instances

```python
"""
Example implementation of cost reduction using Spot Instances.
Integration with EC2 Fleet / ECS Capacity Provider / EKS Karpenter.
"""
import boto3
import json
from datetime import datetime, timedelta


def get_spot_price_history(
    instance_types: list[str],
    availability_zones: list[str] = None,
    days: int = 7,
) -> dict:
    """Retrieve and analyze Spot price history"""
    ec2 = boto3.client("ec2", region_name="ap-northeast-1")

    params = {
        "InstanceTypes": instance_types,
        "ProductDescriptions": ["Linux/UNIX"],
        "StartTime": datetime.now() - timedelta(days=days),
        "EndTime": datetime.now(),
    }
    if availability_zones:
        params["AvailabilityZone"] = availability_zones[0]

    response = ec2.describe_spot_price_history(**params)

    # Aggregate by instance type
    price_data = {}
    for item in response["SpotPriceHistory"]:
        itype = item["InstanceType"]
        price = float(item["SpotPrice"])
        az = item["AvailabilityZone"]

        key = f"{itype}/{az}"
        if key not in price_data:
            price_data[key] = {
                "instance_type": itype,
                "az": az,
                "prices": [],
            }
        price_data[key]["prices"].append(price)

    # Calculate statistics
    results = {}
    for key, data in price_data.items():
        prices = data["prices"]
        results[key] = {
            "instance_type": data["instance_type"],
            "az": data["az"],
            "avg_price": round(sum(prices) / len(prices), 4),
            "min_price": round(min(prices), 4),
            "max_price": round(max(prices), 4),
            "price_stability": round(
                1 - (max(prices) - min(prices)) / (sum(prices) / len(prices)),
                2,
            ),
            "data_points": len(prices),
        }

    return results


def create_spot_fleet_request(
    target_capacity: int = 10,
    instance_types: list[str] = None,
    subnets: list[str] = None,
    iam_fleet_role: str = "",
) -> str:
    """Create a diverse Spot Fleet request"""
    ec2 = boto3.client("ec2", region_name="ap-northeast-1")

    if instance_types is None:
        instance_types = [
            "m5.large", "m5a.large", "m5d.large",
            "m6i.large", "m6a.large",
            "c5.large", "c5a.large", "c6i.large",
        ]

    launch_specifications = []
    for itype in instance_types:
        for subnet in (subnets or []):
            launch_specifications.append({
                "InstanceType": itype,
                "SubnetId": subnet,
                "ImageId": "ami-0123456789abcdef0",  # Latest AMI
                "KeyName": "my-key",
                "SecurityGroups": [{"GroupId": "sg-0123456789abcdef0"}],
                "TagSpecifications": [
                    {
                        "ResourceType": "instance",
                        "Tags": [
                            {"Key": "Environment", "Value": "prod"},
                            {"Key": "LaunchType", "Value": "spot-fleet"},
                        ],
                    }
                ],
            })

    response = ec2.request_spot_fleet(
        SpotFleetRequestConfig={
            "IamFleetRole": iam_fleet_role,
            "TargetCapacity": target_capacity,
            "SpotPrice": "0.10",  # Maximum price willing to pay
            "AllocationStrategy": "capacityOptimized",
            "TerminateInstancesWithExpiration": True,
            "Type": "maintain",
            "LaunchSpecifications": launch_specifications,
            "OnDemandTargetCapacity": int(target_capacity * 0.2),
            "OnDemandAllocationStrategy": "lowestPrice",
            "TagSpecifications": [
                {
                    "ResourceType": "spot-fleet-request",
                    "Tags": [
                        {"Key": "Name", "Value": "production-spot-fleet"},
                    ],
                }
            ],
        }
    )

    return response["SpotFleetRequestId"]
```

---

## 5. Cost & Usage Report (CUR) and Athena Analysis

### 5.1 Configuring CUR

```bash
# Create a CUR report
aws cur put-report-definition \
  --report-definition '{
    "ReportName": "daily-cost-report",
    "TimeUnit": "DAILY",
    "Format": "Parquet",
    "Compression": "Parquet",
    "AdditionalSchemaElements": ["RESOURCES"],
    "S3Bucket": "my-cur-reports-bucket",
    "S3Prefix": "cur/",
    "S3Region": "us-east-1",
    "AdditionalArtifacts": ["ATHENA"],
    "RefreshClosedReports": true,
    "ReportVersioning": "OVERWRITE_REPORT"
  }'
```

### 5.2 Setting Up CUR + Athena Environment with Terraform

```hcl
# S3 bucket (for storing CUR reports)
resource "aws_s3_bucket" "cur_reports" {
  bucket = "my-company-cur-reports"

  tags = {
    Purpose = "cost-and-usage-reports"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cur_lifecycle" {
  bucket = aws_s3_bucket.cur_reports.id

  rule {
    id     = "archive-old-reports"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_policy" "cur_policy" {
  bucket = aws_s3_bucket.cur_reports.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "billingreports.amazonaws.com" }
        Action    = ["s3:GetBucketAcl", "s3:GetBucketPolicy"]
        Resource  = aws_s3_bucket.cur_reports.arn
      },
      {
        Effect    = "Allow"
        Principal = { Service = "billingreports.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.cur_reports.arn}/*"
      },
    ]
  })
}

# CUR report definition
resource "aws_cur_report_definition" "daily_report" {
  report_name                = "daily-cost-report"
  time_unit                  = "DAILY"
  format                     = "Parquet"
  compression                = "Parquet"
  additional_schema_elements = ["RESOURCES"]
  s3_bucket                  = aws_s3_bucket.cur_reports.bucket
  s3_prefix                  = "cur/"
  s3_region                  = "us-east-1"
  additional_artifacts       = ["ATHENA"]
  report_versioning          = "OVERWRITE_REPORT"
  refresh_closed_reports     = true
}

# Athena database
resource "aws_athena_database" "cur_db" {
  name   = "cur_database"
  bucket = aws_s3_bucket.cur_reports.bucket

  encryption_configuration {
    encryption_option = "SSE_S3"
  }
}

# Athena workgroup
resource "aws_athena_workgroup" "cost_analysis" {
  name = "cost-analysis"

  configuration {
    enforce_workgroup_configuration = true
    result_configuration {
      output_location = "s3://${aws_s3_bucket.cur_reports.bucket}/athena-results/"
    }
  }

  tags = {
    Purpose = "cost-analysis"
  }
}
```

### 5.3 Cost Analysis Queries in Athena

```sql
-- Monthly cost by service (top 20 services)
SELECT
  line_item_product_code AS service,
  DATE_FORMAT(line_item_usage_start_date, '%Y-%m') AS month,
  ROUND(SUM(line_item_unblended_cost), 2) AS cost_usd,
  ROUND(SUM(line_item_unblended_cost) / (
    SELECT SUM(line_item_unblended_cost)
    FROM cur_database.cur_report
    WHERE DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
  ) * 100, 1) AS percentage
FROM cur_database.cur_report
WHERE DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
  AND line_item_line_item_type = 'Usage'
GROUP BY line_item_product_code, DATE_FORMAT(line_item_usage_start_date, '%Y-%m')
ORDER BY cost_usd DESC
LIMIT 20;

-- Cost analysis by tag (identifying untagged resources)
SELECT
  COALESCE(resource_tags_user_project, '(untagged)') AS project,
  COALESCE(resource_tags_user_environment, '(untagged)') AS environment,
  line_item_product_code AS service,
  ROUND(SUM(line_item_unblended_cost), 2) AS cost_usd,
  COUNT(DISTINCT line_item_resource_id) AS resource_count
FROM cur_database.cur_report
WHERE DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
  AND line_item_line_item_type = 'Usage'
GROUP BY
  resource_tags_user_project,
  resource_tags_user_environment,
  line_item_product_code
HAVING SUM(line_item_unblended_cost) > 10
ORDER BY cost_usd DESC;

-- EC2 instance cost by ID (for right-sizing)
SELECT
  line_item_resource_id AS instance_id,
  product_instance_type AS instance_type,
  COALESCE(resource_tags_user_name, '(unnamed)') AS name,
  ROUND(SUM(line_item_unblended_cost), 2) AS monthly_cost,
  ROUND(SUM(line_item_usage_amount), 1) AS usage_hours,
  ROUND(SUM(line_item_usage_amount) / 730 * 100, 1) AS utilization_pct
FROM cur_database.cur_report
WHERE line_item_product_code = 'AmazonEC2'
  AND line_item_usage_type LIKE '%BoxUsage%'
  AND DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
GROUP BY line_item_resource_id, product_instance_type, resource_tags_user_name
ORDER BY monthly_cost DESC
LIMIT 50;

-- Data transfer cost analysis
SELECT
  line_item_product_code AS service,
  line_item_usage_type AS usage_type,
  ROUND(SUM(line_item_unblended_cost), 2) AS cost_usd,
  ROUND(SUM(line_item_usage_amount), 2) AS usage_gb
FROM cur_database.cur_report
WHERE line_item_usage_type LIKE '%DataTransfer%'
  AND DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
GROUP BY line_item_product_code, line_item_usage_type
HAVING SUM(line_item_unblended_cost) > 1
ORDER BY cost_usd DESC;

-- Detailed Savings Plans coverage analysis
SELECT
  DATE_FORMAT(line_item_usage_start_date, '%Y-%m-%d') AS usage_date,
  line_item_product_code AS service,
  ROUND(SUM(CASE WHEN savings_plan_savings_plan_arn != '' THEN line_item_unblended_cost ELSE 0 END), 2) AS sp_covered_cost,
  ROUND(SUM(CASE WHEN savings_plan_savings_plan_arn = '' THEN line_item_unblended_cost ELSE 0 END), 2) AS on_demand_cost,
  ROUND(SUM(line_item_unblended_cost), 2) AS total_cost
FROM cur_database.cur_report
WHERE line_item_line_item_type IN ('Usage', 'SavingsPlanCoveredUsage')
  AND DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
GROUP BY DATE_FORMAT(line_item_usage_start_date, '%Y-%m-%d'), line_item_product_code
ORDER BY usage_date, total_cost DESC;

-- Detect unused EBS volumes
SELECT
  line_item_resource_id AS volume_id,
  product_volume_type AS volume_type,
  ROUND(SUM(line_item_usage_amount), 0) AS gb_months,
  ROUND(SUM(line_item_unblended_cost), 2) AS monthly_cost
FROM cur_database.cur_report
WHERE line_item_product_code = 'AmazonEC2'
  AND line_item_usage_type LIKE '%EBS:Volume%'
  AND DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
  AND line_item_resource_id NOT IN (
    SELECT DISTINCT line_item_resource_id
    FROM cur_database.cur_report
    WHERE line_item_usage_type LIKE '%EBS:VolumeIOUsage%'
      AND DATE_FORMAT(line_item_usage_start_date, '%Y-%m') = DATE_FORMAT(CURRENT_DATE - INTERVAL '1' MONTH, '%Y-%m')
  )
GROUP BY line_item_resource_id, product_volume_type
ORDER BY monthly_cost DESC;
```

---

## 6. Right-Sizing with Compute Optimizer

### 6.1 Retrieving Recommendations via CLI

```bash
# Get EC2 instance optimization recommendations
aws compute-optimizer get-ec2-instance-recommendations \
  --output json | jq '.instanceRecommendations[] | {
    instance_id: .instanceArn | split("/") | last,
    current_type: .currentInstanceType,
    finding: .finding,
    recommendations: [.recommendationOptions[:3][] | {
      type: .instanceType,
      projected_utilization: .projectedUtilizationMetrics,
      savings_opportunity: .savingsOpportunity,
      performance_risk: .performanceRisk
    }]
  }'

# EBS volume optimization recommendations
aws compute-optimizer get-ebs-volume-recommendations \
  --output json | jq '.volumeRecommendations[] | {
    volume_arn: .volumeArn,
    current_config: .currentConfiguration,
    finding: .finding,
    recommendations: [.volumeRecommendationOptions[:3][] | {
      config: .configuration,
      performance_risk: .performanceRisk,
      savings_opportunity: .savingsOpportunity
    }]
  }'

# Lambda function optimization recommendations
aws compute-optimizer get-lambda-function-recommendations \
  --output json | jq '.lambdaFunctionRecommendations[] | {
    function_arn: .functionArn,
    current_memory: .currentMemorySize,
    finding: .finding,
    recommendations: [.memorySizeRecommendationOptions[:3][] | {
      memory_size: .memorySize,
      projected_utilization: .projectedUtilizationMetrics,
      savings_opportunity: .savingsOpportunity
    }]
  }'

# Auto Scaling group recommendations
aws compute-optimizer get-auto-scaling-group-recommendations \
  --output json | jq '.autoScalingGroupRecommendations[] | {
    asg_name: .autoScalingGroupName,
    current_config: .currentConfiguration,
    finding: .finding,
    recommendations: [.recommendationOptions[:3][] | {
      config: .configuration,
      projected_utilization: .projectedUtilizationMetrics
    }]
  }'
```

### 6.2 Automated Right-Sizing Report with Python

```python
"""
Generate a right-sizing report based on Compute Optimizer recommendations.
Run monthly to enumerate cost savings opportunities.
"""
import boto3
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class RightsizingRecommendation:
    """Right-sizing recommendation"""
    resource_id: str
    resource_type: str
    current_config: str
    recommended_config: str
    finding: str
    estimated_monthly_savings: float
    performance_risk: float
    tags: dict = field(default_factory=dict)


def get_ec2_rightsizing_recommendations() -> list[RightsizingRecommendation]:
    """Get EC2 right-sizing recommendations"""
    co_client = boto3.client("compute-optimizer", region_name="ap-northeast-1")
    ec2_client = boto3.client("ec2", region_name="ap-northeast-1")

    recommendations = []

    response = co_client.get_ec2_instance_recommendations()

    for rec in response.get("instanceRecommendations", []):
        instance_arn = rec["instanceArn"]
        instance_id = instance_arn.split("/")[-1]
        finding = rec["finding"]

        # Only target OVER_PROVISIONED or UNDER_PROVISIONED
        if finding not in ("OVER_PROVISIONED", "UNDER_PROVISIONED"):
            continue

        # Fetch tags
        tags = {}
        try:
            tags_response = ec2_client.describe_tags(
                Filters=[
                    {"Name": "resource-id", "Values": [instance_id]}
                ]
            )
            tags = {
                t["Key"]: t["Value"]
                for t in tags_response.get("Tags", [])
            }
        except Exception:
            pass

        for option in rec.get("recommendationOptions", [])[:1]:
            savings = option.get("savingsOpportunity", {})
            monthly_savings = float(
                savings.get("estimatedMonthlySavings", {}).get("value", 0)
            )
            perf_risk = float(option.get("performanceRisk", 0))

            recommendations.append(
                RightsizingRecommendation(
                    resource_id=instance_id,
                    resource_type="EC2",
                    current_config=rec["currentInstanceType"],
                    recommended_config=option["instanceType"],
                    finding=finding,
                    estimated_monthly_savings=monthly_savings,
                    performance_risk=perf_risk,
                    tags=tags,
                )
            )

    return recommendations


def generate_rightsizing_report() -> str:
    """Generate a right-sizing report in Markdown format"""
    recs = get_ec2_rightsizing_recommendations()

    lines = [
        f"# EC2 Right-Sizing Report",
        f"Generated at: {datetime.now().isoformat()}",
        f"Total recommendations: {len(recs)}",
        "",
    ]

    # Summary
    total_savings = sum(r.estimated_monthly_savings for r in recs)
    over_provisioned = [r for r in recs if r.finding == "OVER_PROVISIONED"]
    under_provisioned = [r for r in recs if r.finding == "UNDER_PROVISIONED"]

    lines.append("## Summary")
    lines.append(f"- Estimated monthly cost savings: **${total_savings:,.2f}**")
    lines.append(f"- Over-Provisioned: {len(over_provisioned)} instances")
    lines.append(f"- Under-Provisioned: {len(under_provisioned)} instances")
    lines.append("")

    # Detail table
    lines.append("## Detailed Recommendations")
    lines.append("| Instance ID | Name | Current | Recommended | Finding | Monthly Savings | Risk |")
    lines.append("|---|---|---|---|---|---|---|")

    recs.sort(key=lambda r: r.estimated_monthly_savings, reverse=True)

    for r in recs:
        name = r.tags.get("Name", "-")
        lines.append(
            f"| {r.resource_id} | {name} | {r.current_config} | "
            f"{r.recommended_config} | {r.finding} | "
            f"${r.estimated_monthly_savings:,.2f} | {r.performance_risk} |"
        )

    return "\n".join(lines)
```

---

## 7. Comparison Tables

### 7.1 Discount Plan Comparison

| Plan | Max Discount | Flexibility | Commitment Term | Payment Options |
|--------|---------|--------|-------------|-----------|
| **Compute Savings Plans** | 66% | High (any EC2/Fargate/Lambda) | 1yr or 3yr | All/Partial/No Upfront |
| **EC2 Instance Savings Plans** | 72% | Medium (family & region fixed) | 1yr or 3yr | All/Partial/No Upfront |
| **Standard RI** | 72% | Low (instance type & AZ fixed) | 1yr or 3yr | All/Partial/No Upfront |
| **Convertible RI** | 66% | Medium (changeable) | 1yr or 3yr | All/Partial/No Upfront |
| **Spot Instances** | 90% | None (may be interrupted) | None | On-demand |

### 7.2 Cost Management Tool Comparison

| Tool | Purpose | Cost | Key Features |
|-------|------|------|---------|
| **Cost Explorer** | Cost analysis | Free | Graph visualization, filters, forecasting |
| **AWS Budgets** | Budget management | First 2 free, then $0.02/day | Alerts, automated actions |
| **Cost Anomaly Detection** | Anomaly detection | Free | ML-based anomaly detection |
| **CUR (Cost & Usage Report)** | Detailed reporting | Free (S3 costs only) | Row-level detailed data |
| **Compute Optimizer** | Sizing recommendations | Free | ML-based optimization recommendations |
| **Trusted Advisor** | Best practices | Business/Enterprise Support | Unused resource detection |

### 7.3 Payment Option Comparison

| Payment Option | Discount Rate | Upfront Cost | Monthly Cost | Best For |
|-----------------|--------|---------|---------|-----------|
| **All Upfront** | Maximum | Lump sum | None | Cash-rich, long-term stable workloads |
| **Partial Upfront** | Moderate | Partial payment | Pay rest monthly | Balanced, most common |
| **No Upfront** | Minimum | None | Full monthly payment | Cash flow priority, first SP purchase |

### 7.4 Savings Plans vs Reserved Instances Decision Matrix

| Criteria | Savings Plans Recommended | Reserved Instances Recommended |
|---------|-------------------|----------------------|
| **Services used** | EC2 + Fargate + Lambda mix | EC2 only |
| **Instance family changes** | Possible | No changes planned |
| **Region changes** | Possible | Fixed |
| **OS changes** | Possible | Fixed |
| **Marketplace resale** | Not needed | Want to sell surplus |
| **Capacity reservation** | Not needed | AZ reservation required |

---

## 8. Service-Specific Cost Optimization Best Practices

### 8.1 EC2 Cost Optimization

```bash
# Detect unused Elastic IPs
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId==`null`].[PublicIp,AllocationId]' \
  --output table

# Detect EBS volumes attached to stopped instances
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].{ID:VolumeId,Size:Size,Type:VolumeType,Created:CreateTime}' \
  --output table

# Detect old AMIs (older than 90 days)
THRESHOLD=$(date -d "90 days ago" +%Y-%m-%d 2>/dev/null || date -v-90d +%Y-%m-%d)
aws ec2 describe-images \
  --owners self \
  --query "Images[?CreationDate<'${THRESHOLD}'].[ImageId,Name,CreationDate]" \
  --output table

# Detect old snapshots
aws ec2 describe-snapshots \
  --owner-ids self \
  --query "Snapshots[?StartTime<'${THRESHOLD}'].[SnapshotId,VolumeSize,StartTime,Description]" \
  --output table

# Detect unused NAT Gateways (check via CloudWatch metrics)
for gw in $(aws ec2 describe-nat-gateways --query 'NatGateways[*].NatGatewayId' --output text); do
  bytes=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/NATGateway \
    --metric-name BytesOutToDestination \
    --dimensions Name=NatGatewayId,Value=$gw \
    --start-time "$(date -d '7 days ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -v-7d +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date +%Y-%m-%dT%H:%M:%S)" \
    --period 604800 \
    --statistics Sum \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null)
  echo "NAT GW: $gw - Bytes out (7d): ${bytes:-0}"
done
```

### 8.2 S3 Cost Optimization

```hcl
# S3 Intelligent-Tiering and lifecycle policies
resource "aws_s3_bucket_intelligent_tiering_configuration" "cost_optimized" {
  bucket = aws_s3_bucket.data.id
  name   = "cost-optimized-tiering"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cost_optimized" {
  bucket = aws_s3_bucket.data.id

  # Log files: move to IA after 30 days, Glacier after 90 days, delete after 365 days
  rule {
    id     = "log-lifecycle"
    status = "Enabled"

    filter {
      prefix = "logs/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }

  # Clean up incomplete multipart uploads after 7 days
  rule {
    id     = "abort-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }

  # Delete old versions after 30 days
  rule {
    id     = "noncurrent-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}
```

### 8.3 RDS Cost Optimization

```bash
# Detect unused RDS instances (zero connections)
for db in $(aws rds describe-db-instances --query 'DBInstances[*].DBInstanceIdentifier' --output text); do
  connections=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name DatabaseConnections \
    --dimensions Name=DBInstanceIdentifier,Value=$db \
    --start-time "$(date -d '7 days ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -v-7d +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date +%Y-%m-%dT%H:%M:%S)" \
    --period 604800 \
    --statistics Maximum \
    --query 'Datapoints[0].Maximum' \
    --output text 2>/dev/null)
  echo "RDS: $db - Max connections (7d): ${connections:-0}"
done

# Detect over-provisioned RDS instances (CPU utilization below 10%)
for db in $(aws rds describe-db-instances --query 'DBInstances[*].DBInstanceIdentifier' --output text); do
  cpu=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name CPUUtilization \
    --dimensions Name=DBInstanceIdentifier,Value=$db \
    --start-time "$(date -d '7 days ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -v-7d +%Y-%m-%dT%H:%M:%S)" \
    --end-time "$(date +%Y-%m-%dT%H:%M:%S)" \
    --period 604800 \
    --statistics Average \
    --query 'Datapoints[0].Average' \
    --output text 2>/dev/null)
  if [ -n "$cpu" ] && [ "$(echo "$cpu < 10" | bc -l 2>/dev/null)" = "1" ]; then
    echo "LOW UTILIZATION - RDS: $db - Avg CPU (7d): ${cpu}%"
  fi
done
```

### 8.4 Lambda Cost Optimization

```python
"""
Lambda function cost optimization analysis.
Recommends memory setting optimization and appropriate provisioned concurrency configuration.
"""
import boto3
from datetime import datetime, timedelta


def analyze_lambda_cost_optimization(
    region: str = "ap-northeast-1",
) -> list[dict]:
    """Generate Lambda function cost optimization recommendations"""
    lambda_client = boto3.client("lambda", region_name=region)
    cw_client = boto3.client("cloudwatch", region_name=region)

    functions = lambda_client.list_functions()["Functions"]
    recommendations = []

    for func in functions:
        func_name = func["FunctionName"]
        memory = func["MemorySize"]

        # Get metrics for the past 7 days
        end_time = datetime.now()
        start_time = end_time - timedelta(days=7)

        # Duration statistics
        duration_stats = cw_client.get_metric_statistics(
            Namespace="AWS/Lambda",
            MetricName="Duration",
            Dimensions=[{"Name": "FunctionName", "Value": func_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=86400,  # 1 day
            Statistics=["Average", "Maximum", "p90"],
        )

        # Invocation count
        invocations = cw_client.get_metric_statistics(
            Namespace="AWS/Lambda",
            MetricName="Invocations",
            Dimensions=[{"Name": "FunctionName", "Value": func_name}],
            StartTime=start_time,
            EndTime=end_time,
            Period=604800,  # 1 week
            Statistics=["Sum"],
        )

        avg_duration = 0
        max_duration = 0
        total_invocations = 0

        if duration_stats["Datapoints"]:
            avg_duration = sum(
                d["Average"] for d in duration_stats["Datapoints"]
            ) / len(duration_stats["Datapoints"])
            max_duration = max(
                d["Maximum"] for d in duration_stats["Datapoints"]
            )

        if invocations["Datapoints"]:
            total_invocations = int(invocations["Datapoints"][0]["Sum"])

        # Cost calculation ($0.0000166667 per GB-second)
        gb_seconds = (memory / 1024) * (avg_duration / 1000) * total_invocations
        estimated_weekly_cost = gb_seconds * 0.0000166667

        # Estimate recommended memory size
        recommended_memory = memory
        if avg_duration > 0 and max_duration < memory * 0.5:
            recommended_memory = max(128, memory // 2)

        recommendation = {
            "function_name": func_name,
            "current_memory_mb": memory,
            "avg_duration_ms": round(avg_duration, 1),
            "max_duration_ms": round(max_duration, 1),
            "weekly_invocations": total_invocations,
            "estimated_weekly_cost": round(estimated_weekly_cost, 4),
            "recommended_memory_mb": recommended_memory,
        }

        if recommended_memory != memory:
            savings_pct = (1 - recommended_memory / memory) * 100
            recommendation["potential_savings_pct"] = round(savings_pct, 1)
            recommendation["action"] = "REDUCE_MEMORY"
        else:
            recommendation["action"] = "NO_CHANGE"

        recommendations.append(recommendation)

    return recommendations
```

---

## 9. Anti-Patterns

### 9.1 Running Dev Environments 24/7

```
BAD:
  Dev EC2 (m5.xlarge x 3) + RDS (db.r5.large)
  → Running 24/7/365 = approx. $500/month

GOOD:
  Run only weekdays 9:00-21:00 (EventBridge Scheduler)
  → 160 hours/month / 720 hours = approx. $110/month (78% reduction)

  # Auto stop/start with EventBridge Scheduler
  aws scheduler create-schedule \
    --name "stop-dev-instances" \
    --schedule-expression "cron(0 21 ? * MON-FRI *)" \
    --target '{"Arn":"arn:aws:ssm:...:automation-definition/AWS-StopEC2Instance"}'
```

### 9.2 Purchasing Savings Plans Without Analyzing Workloads

```
BAD:
  "72% discount is attractive" → Buy large amounts with 3-year all-upfront
  → Architecture changes 6 months later → Savings Plans go to waste

GOOD:
  1. Analyze 60-90 days of usage trends in Cost Explorer
  2. Identify baseline usage (minimum usage)
  3. Purchase Savings Plans only for the baseline (70-80% coverage)
  4. Handle peaks with On-Demand or Spot
  5. Start with 1-year, no-upfront; move to 3-year once confident
```

### 9.3 Deferring Tagging

```
BAD:
  Don't define tagging rules at project start
  → Start tagging after 100+ resources have been created
  → "Unclassified" in cost allocation reports exceeds 40%

GOOD:
  Enforce tagging from Day 1
  1. Block resource creation without tags via SCP
  2. Detect untagged resources with AWS Config required-tags rule
  3. Embed tagging checks in CI/CD pipeline
  4. Regularly review and remediate untagged resources with Tag Editor
```

### 9.4 Overlooking Data Transfer Costs

```
BAD:
  Leave inter-region data transfers unaddressed in multi-region setup
  → $500+ in data transfer charges per month

GOOD:
  1. Use VPC Endpoints to optimize access to S3/DynamoDB
  2. Use CloudFront to reduce data transfer from origin
  3. Design to minimize inter-region data transfers
  4. Regularly review data transfer reports in CUR
```

### 9.5 Using One Size for Everything

```
BAD:
  Use m5.xlarge for all workloads
  → Over-provisioned for batch, under-provisioned for API servers

GOOD:
  Choose instance type based on workload characteristics
  ┌─────────────────────────────────────────────────┐
  │  Web API    → c6i.large (compute optimized)     │
  │  Batch jobs → m6i.large (balanced) + Spot       │
  │  ML inference → g5.xlarge (GPU) or inf2.xlarge  │
  │  Cache      → r6i.large (memory optimized)      │
  │  Dev env    → t3.medium (burstable)              │
  └─────────────────────────────────────────────────┘
```

---

## 10. Organizational Cost Management (Organizations / Multi-Account)

### 10.1 Cost Management with Organizations

```hcl
# Bulk define per-account budgets within an organization
variable "account_budgets" {
  type = map(object({
    account_id   = string
    budget_limit = string
    email        = string
  }))
  default = {
    production = {
      account_id   = "111111111111"
      budget_limit = "5000"
      email        = "prod-team@example.com"
    }
    staging = {
      account_id   = "222222222222"
      budget_limit = "1000"
      email        = "staging-team@example.com"
    }
    development = {
      account_id   = "333333333333"
      budget_limit = "500"
      email        = "dev-team@example.com"
    }
    sandbox = {
      account_id   = "444444444444"
      budget_limit = "200"
      email        = "sandbox-admin@example.com"
    }
  }
}

resource "aws_budgets_budget" "account_budgets" {
  for_each = var.account_budgets

  name         = "${each.key}-account-budget"
  budget_type  = "COST"
  limit_amount = each.value.budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "LinkedAccount"
    values = [each.value.account_id]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [each.value.email, "finops@example.com"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [each.value.email, "finops@example.com"]
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_alerts.arn]
  }
}
```

### 10.2 Cost Control via SCP

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyExpensiveInstances",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "arn:aws:ec2:*:*:instance/*",
      "Condition": {
        "ForAnyValue:StringNotLike": {
          "ec2:InstanceType": [
            "t3.*",
            "t3a.*",
            "m5.large",
            "m5.xlarge",
            "m6i.large",
            "m6i.xlarge",
            "c5.large",
            "c5.xlarge",
            "c6i.large",
            "c6i.xlarge"
          ]
        }
      }
    },
    {
      "Sid": "DenyExpensiveRegions",
      "Effect": "Deny",
      "Action": "*",
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:RequestedRegion": [
            "ap-northeast-1",
            "us-east-1",
            "us-west-2"
          ]
        }
      }
    },
    {
      "Sid": "RequireEnvironmentTag",
      "Effect": "Deny",
      "Action": [
        "ec2:RunInstances",
        "rds:CreateDBInstance",
        "lambda:CreateFunction"
      ],
      "Resource": "*",
      "Condition": {
        "Null": {
          "aws:RequestTag/Environment": "true"
        }
      }
    }
  ]
}
```

---

## 11. FAQ

### Q1. What is the difference between Cost Explorer and CUR (Cost and Usage Report)?

**A.** Cost Explorer is a visualization tool in the console, suitable for monthly and daily summaries. CUR outputs row-level detailed data to S3 and enables custom analysis with Athena or QuickSight. For Organizations at the scale of dozens of accounts, CUR + Athena is essential.

### Q2. Tagging is insufficient and "unclassified" costs are high. How do I improve this?

**A.** Use the AWS Config rule `required-tags` to detect resources without tags, and use Service Control Policy (SCP) to block creation of untagged resources. For existing resources, bulk tagging is possible with Tag Editor.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RequireTags",
      "Effect": "Deny",
      "Action": ["ec2:RunInstances"],
      "Resource": "*",
      "Condition": {
        "Null": {
          "aws:RequestTag/Environment": "true"
        }
      }
    }
  ]
}
```

### Q3. What types of workloads are Spot Instances suited for?

**A.** Spot Instances are best suited for interruption-tolerant workloads such as batch processing, CI/CD, data analytics, and machine learning training. Using ECS Capacity Provider or EKS Karpenter to automatically manage Spot can also automate rescheduling on interruption. For web servers, a mixed approach (70% On-Demand + 30% Spot) is safer.

### Q4. What happens if usage decreases after purchasing Savings Plans?

**A.** Savings Plans require payment of the committed hourly amount regardless of actual usage. Surplus becomes waste, so the following countermeasures are recommended.

1. **Phased purchasing**: Cover only 70-80% of the baseline first and handle the rest with On-Demand
2. **Start short-term**: Initially purchase 1-year, no-upfront, then move to 3-year once usage patterns stabilize
3. **Regular review**: Check Savings Plans coverage and utilization monthly
4. **Leverage Organizations**: Savings Plans can be shared across all accounts in an organization

### Q5. What is the priority order for cost optimization?

**A.** Tackling in the following order yields the greatest effect.

```
1. Delete unused resources (immediate effect, no risk)
   └─ Stopped EC2, unused EBS/EIP/NAT GW

2. Right-sizing (short-term, low risk)
   └─ Follow Compute Optimizer recommendations and change gradually

3. Scheduling (short-term, low risk)
   └─ Auto stop/start for dev environments

4. Pricing model optimization (medium-term)
   └─ Purchase Savings Plans / Reserved Instances

5. Architecture optimization (long-term, high impact)
   └─ Serverless adoption, managed service utilization
```

### Q6. What are the best practices for cost management in a multi-account environment?

**A.** Use AWS Organizations with the following recommended setup.

1. **Management account**: Enable Consolidated Billing
2. **Cost management account**: Aggregate CUR, Athena, and QuickSight
3. **Per-account budgets**: Set monthly budgets and alerts for each account
4. **SCP**: Restrict use of expensive instance types and regions
5. **Savings Plans**: Purchase centrally from the management account (shared across all accounts)

### Q7. How much cost reduction can be achieved by migrating to Graviton (ARM) instances?

**A.** Graviton instances offer approximately 20% cost reduction compared to equivalent x86 instances. In addition, performance can improve by up to 40% in some cases. When migrating, confirm the following.

1. Whether the application supports ARM architecture
2. Whether dependent libraries can be compiled for ARM
3. For containers, whether multi-architecture images can be built
4. Whether the CI/CD pipeline supports ARM builds

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Understanding deepens not just from theory but from actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the foundational concepts explained in this guide before moving to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 12. Summary

| Item | Key Point |
|------|---------|
| **Cost Explorer** | First step in cost visibility; analyze by tag and service |
| **Budgets** | Budget alerts and automated actions (e.g., stop EC2) |
| **Savings Plans** | Start with 1-year Compute SP for baseline usage |
| **CUR + Athena** | Detailed cost analysis platform for large-scale environments |
| **Compute Optimizer** | ML-based right-sizing recommendations |
| **Tag Strategy** | Require Environment / Project / Team tags on all resources |
| **FinOps Culture** | Everyone is a cost owner; establish monthly review habits |
| **Continuous Improvement** | Monthly cost reviews, quarterly strategy reassessment |

---

## Next Guides to Read

- [01-well-architected.md](./01-well-architected.md) — The 6 pillars of the Well-Architected Framework
- Compute Optimizer Usage Guide — Automating right-sizing
- Organizations Cost Management — Cost allocation in multi-account environments

---

## References

1. **AWS Official Documentation** — "AWS Cost Management User Guide" — https://docs.aws.amazon.com/cost-management/latest/userguide/
2. **AWS Official Documentation** — "Savings Plans User Guide" — https://docs.aws.amazon.com/savingsplans/latest/userguide/
3. **AWS Well-Architected Framework** — Cost Optimization Pillar — https://docs.aws.amazon.com/wellarchirected/latest/cost-optimization-pillar/
4. **AWS Official Blog** — "AWS Cost Optimization Best Practices" — https://aws.amazon.com/blogs/aws-cloud-financial-management/
5. **AWS Official Documentation** — "AWS Compute Optimizer User Guide" — https://docs.aws.amazon.com/compute-optimizer/latest/ug/
6. **AWS Official Documentation** — "AWS Cost and Usage Reports User Guide" — https://docs.aws.amazon.com/cur/latest/userguide/
7. **FinOps Foundation** — "FinOps Framework" — https://www.finops.org/framework/
