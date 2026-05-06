# WAF / Shield — WAF Rules and DDoS Protection

> A practical guide to defending against application-layer (L7) attacks with AWS WAF and protecting against DDoS attacks (L3/L4) with AWS Shield.

---

## What You Will Learn

1. **AWS WAF** rule design and request filtering via Web ACL
2. **AWS Shield Standard / Advanced** DDoS protection architecture
3. Multi-layered defense patterns combining **WAF + CloudFront + ALB**
4. **WAF log analysis and operations** — Athena, CloudWatch, and automated response
5. **WAF IaC management with CDK/Terraform** — reproducible security configurations


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [Secret Management — Secrets Manager / Parameter Store / KMS](./01-secrets-management.md)

---

## 1. AWS WAF Overall Architecture

### 1.1 WAF Placement and Processing Flow

```
┌─────────┐     ┌──────────────┐     ┌───────────┐     ┌─────────┐
│ Client  │ ──→ │ CloudFront   │ ──→ │  ALB      │ ──→ │ EC2/ECS │
│(Attacker)│    │ + WAF        │     │ + WAF     │     │ App     │
└─────────┘     │ (Edge Guard) │     │ (Regional │     └─────────┘
                └──────┬───────┘     │  Guard)   │
                       │             └─────┬─────┘
                 Web ACL Evaluation   Web ACL Evaluation
                       │                   │
                ┌──────▼───────┐     ┌─────▼─────┐
                │ Allow/Block  │     │ Allow/Block│
                │ /Count/CAPTCHA│    │ /Count    │
                └──────────────┘     └───────────┘
```

### 1.2 WAF Rule Evaluation Order

```
┌─────────────────────────────────────────────────┐
│              Web ACL Rule Evaluation             │
│                                                 │
│  Priority 0:  IP Block List (Block)             │
│       │                                         │
│       ▼ If no match, proceed to next            │
│  Priority 1:  AWS Managed Rules - Common        │
│       │       (Block SQLi, XSS, etc.)           │
│       ▼                                         │
│  Priority 2:  Rate-Based Rule                   │
│       │       (Block if > 2000 req/5min)        │
│       ▼                                         │
│  Priority 3:  Geo Match Rule                    │
│       │       (Block from specific countries)   │
│       ▼                                         │
│  Priority 4:  Custom Rules                      │
│       │       (Bot detection, etc.)             │
│       ▼                                         │
│  Default Action: Allow                          │
│  (Requests that did not match any rule)         │
└─────────────────────────────────────────────────┘
```

### 1.3 Resources Supported by WAF

| Resource Type | Scope | Use Case |
|--------------|---------|------|
| **Amazon CloudFront** | CLOUDFRONT | Global edge protection |
| **Application Load Balancer** | REGIONAL | Regional L7 protection |
| **Amazon API Gateway REST API** | REGIONAL | API endpoint protection |
| **AWS AppSync GraphQL API** | REGIONAL | GraphQL API protection |
| **Amazon Cognito User Pool** | REGIONAL | Auth endpoint protection |
| **AWS App Runner** | REGIONAL | Container service protection |
| **AWS Verified Access** | REGIONAL | Zero-trust access protection |

---

## 2. WAF Rule Design

### 2.1 Applying AWS Managed Rules (CloudFormation)

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  WebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: production-web-acl
      Scope: REGIONAL    # For ALB/API Gateway. Use CLOUDFRONT for CloudFront
      DefaultAction:
        Allow: {}
      VisibilityConfig:
        CloudWatchMetricsEnabled: true
        MetricName: production-web-acl
        SampledRequestsEnabled: true
      Rules:
        # AWS Managed Rule: Common vulnerabilities
        - Name: AWSManagedRulesCommonRuleSet
          Priority: 0
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesCommonRuleSet
              ExcludedRules:
                - Name: SizeRestrictions_BODY    # If large POST bodies are needed
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: CommonRuleSet
            SampledRequestsEnabled: true

        # AWS Managed Rule: SQL Injection
        - Name: AWSManagedRulesSQLiRuleSet
          Priority: 1
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesSQLiRuleSet
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: SQLiRuleSet
            SampledRequestsEnabled: true

        # AWS Managed Rule: Known bad inputs
        - Name: AWSManagedRulesKnownBadInputsRuleSet
          Priority: 2
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesKnownBadInputsRuleSet
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: KnownBadInputs
            SampledRequestsEnabled: true

        # AWS Managed Rule: Linux OS-specific attacks
        - Name: AWSManagedRulesLinuxRuleSet
          Priority: 3
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesLinuxRuleSet
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: LinuxRuleSet
            SampledRequestsEnabled: true

        # Rate-based rule
        - Name: RateLimitRule
          Priority: 4
          Action:
            Block: {}
          Statement:
            RateBasedStatement:
              Limit: 2000           # 2000 requests per 5 minutes
              AggregateKeyType: IP
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: RateLimitRule
            SampledRequestsEnabled: true

        # IP block list
        - Name: IPBlockList
          Priority: 5
          Action:
            Block:
              CustomResponse:
                ResponseCode: 403
                CustomResponseBodyKey: BlockedResponse
          Statement:
            IPSetReferenceStatement:
              Arn: !GetAtt BlockedIPSet.Arn
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: IPBlockList
            SampledRequestsEnabled: true

      CustomResponseBodies:
        BlockedResponse:
          ContentType: APPLICATION_JSON
          Content: '{"error":"Access denied","code":"BLOCKED"}'

  BlockedIPSet:
    Type: AWS::WAFv2::IPSet
    Properties:
      Name: blocked-ips
      Scope: REGIONAL
      IPAddressVersion: IPV4
      Addresses: []    # Dynamically added via CLI/API

  # Association with ALB
  WebACLAssociation:
    Type: AWS::WAFv2::WebACLAssociation
    Properties:
      ResourceArn: !Ref ApplicationLoadBalancerArn
      WebACLArn: !GetAtt WebACL.Arn
```

### 2.2 Custom Rules: Protecting Specific Paths

```yaml
        # Restrict access to /admin by IP
        - Name: AdminPathIPRestriction
          Priority: 6
          Action:
            Block: {}
          Statement:
            AndStatement:
              Statements:
                - ByteMatchStatement:
                    SearchString: /admin
                    FieldToMatch:
                      UriPath: {}
                    TextTransformations:
                      - Priority: 0
                        Type: LOWERCASE
                    PositionalConstraint: STARTS_WITH
                - NotStatement:
                    Statement:
                      IPSetReferenceStatement:
                        Arn: !GetAtt AllowedAdminIPs.Arn
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: AdminIPRestriction
            SampledRequestsEnabled: true

        # CAPTCHA challenge (bot mitigation)
        - Name: CAPTCHAForSensitivePaths
          Priority: 7
          Action:
            Captcha:
              CustomRequestHandling:
                InsertHeaders:
                  - Name: x-waf-captcha-verified
                    Value: "true"
          Statement:
            OrStatement:
              Statements:
                - ByteMatchStatement:
                    SearchString: /api/signup
                    FieldToMatch:
                      UriPath: {}
                    TextTransformations:
                      - Priority: 0
                        Type: LOWERCASE
                    PositionalConstraint: EXACTLY
                - ByteMatchStatement:
                    SearchString: /api/contact
                    FieldToMatch:
                      UriPath: {}
                    TextTransformations:
                      - Priority: 0
                        Type: LOWERCASE
                    PositionalConstraint: EXACTLY
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: CAPTCHAChallenge
            SampledRequestsEnabled: true

        # Inspect specific headers
        - Name: RequireAPIKey
          Priority: 8
          Action:
            Block: {}
          Statement:
            AndStatement:
              Statements:
                - ByteMatchStatement:
                    SearchString: /api/
                    FieldToMatch:
                      UriPath: {}
                    TextTransformations:
                      - Priority: 0
                        Type: LOWERCASE
                    PositionalConstraint: STARTS_WITH
                - NotStatement:
                    Statement:
                      SizeConstraintStatement:
                        ComparisonOperator: GT
                        Size: 0
                        FieldToMatch:
                          SingleHeader:
                            Name: x-api-key
                        TextTransformations:
                          - Priority: 0
                            Type: NONE
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: RequireAPIKey
            SampledRequestsEnabled: true

  AllowedAdminIPs:
    Type: AWS::WAFv2::IPSet
    Properties:
      Name: allowed-admin-ips
      Scope: REGIONAL
      IPAddressVersion: IPV4
      Addresses:
        - 203.0.113.0/24     # Office IP
        - 198.51.100.10/32   # VPN IP
```

### 2.3 WAF Configuration with Terraform

```hcl
resource "aws_wafv2_web_acl" "main" {
  name        = "production-web-acl"
  scope       = "REGIONAL"
  description = "Production WAF ACL"

  default_action {
    allow {}
  }

  # Bot Control
  rule {
    name     = "BotControl"
    priority = 0

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesBotControlRuleSet"

        managed_rule_group_configs {
          aws_managed_rules_bot_control_rule_set {
            inspection_level = "COMMON"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "BotControl"
      sampled_requests_enabled   = true
    }
  }

  # Custom: rate limit on login endpoint
  rule {
    name     = "LoginRateLimit"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 100    # 100 times per 5 minutes
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            positional_constraint = "STARTS_WITH"
            search_string         = "/api/login"

            field_to_match {
              uri_path {}
            }

            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "LoginRateLimit"
      sampled_requests_enabled   = true
    }
  }

  # Geo restriction: block access from specific countries
  rule {
    name     = "GeoRestriction"
    priority = 2

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = ["CN", "RU", "KP"]  # Adjust as needed
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoRestriction"
      sampled_requests_enabled   = true
    }
  }

  # Request body size limit
  rule {
    name     = "RequestBodySizeLimit"
    priority = 3

    action {
      block {}
    }

    statement {
      size_constraint_statement {
        comparison_operator = "GT"
        size               = 10485760  # 10MB

        field_to_match {
          body {
            oversize_handling = "MATCH"
          }
        }

        text_transformation {
          priority = 0
          type     = "NONE"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RequestBodySizeLimit"
      sampled_requests_enabled   = true
    }
  }

  # Account Takeover Prevention (ATP)
  rule {
    name     = "AccountTakeoverPrevention"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesATPRuleSet"

        managed_rule_group_configs {
          aws_managed_rules_atp_rule_set {
            login_path = "/api/login"

            request_inspection {
              payload_type = "JSON"

              username_field {
                identifier = "/username"
              }

              password_field {
                identifier = "/password"
              }
            }

            response_inspection {
              status_code {
                success_codes = [200, 201]
                failure_codes = [401, 403]
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "ATP"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "production-web-acl"
    sampled_requests_enabled   = true
  }

  tags = {
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
```

### 2.4 Enabling and Analyzing WAF Logs

```bash
# Send WAF logs to S3
aws wafv2 put-logging-configuration \
  --logging-configuration '{
    "ResourceArn": "arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/production-web-acl/xxxx",
    "LogDestinationConfigs": [
      "arn:aws:s3:::my-waf-logs-bucket"
    ],
    "RedactedFields": [
      {"SingleHeader": {"Name": "authorization"}},
      {"SingleHeader": {"Name": "cookie"}}
    ],
    "LoggingFilter": {
      "DefaultBehavior": "KEEP",
      "Filters": [
        {
          "Behavior": "KEEP",
          "Conditions": [
            {
              "ActionCondition": {
                "Action": "BLOCK"
              }
            }
          ],
          "Requirement": "MEETS_ANY"
        }
      ]
    }
  }'

# Send WAF logs to CloudWatch Logs
aws wafv2 put-logging-configuration \
  --logging-configuration '{
    "ResourceArn": "arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/production-web-acl/xxxx",
    "LogDestinationConfigs": [
      "arn:aws:logs:ap-northeast-1:123456789012:log-group:aws-waf-logs-production"
    ]
  }'

# Send to S3 + OpenSearch via Kinesis Data Firehose
aws wafv2 put-logging-configuration \
  --logging-configuration '{
    "ResourceArn": "arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/production-web-acl/xxxx",
    "LogDestinationConfigs": [
      "arn:aws:firehose:ap-northeast-1:123456789012:deliverystream/aws-waf-logs-stream"
    ]
  }'
```

### 2.5 WAF Log Analysis with Athena

```sql
-- Create Athena table
CREATE EXTERNAL TABLE waf_logs (
  timestamp bigint,
  formatVersion int,
  webaclId string,
  terminatingRuleId string,
  terminatingRuleType string,
  action string,
  terminatingRuleMatchDetails array<struct<
    conditionType:string,
    sensitivityLevel:string,
    location:string,
    matchedData:array<string>
  >>,
  httpSourceName string,
  httpSourceId string,
  ruleGroupList array<struct<
    ruleGroupId:string,
    terminatingRule:struct<ruleId:string,action:string,ruleMatchDetails:string>,
    nonTerminatingMatchingRules:array<struct<ruleId:string,action:string>>,
    excludedRules:array<struct<ruleId:string,exclusionType:string>>
  >>,
  rateBasedRuleList array<struct<
    rateBasedRuleId:string,
    limitKey:string,
    maxRateAllowed:int
  >>,
  nonTerminatingMatchingRules array<struct<
    ruleId:string,
    action:string,
    ruleMatchDetails:array<struct<
      conditionType:string,
      sensitivityLevel:string,
      location:string,
      matchedData:array<string>
    >>
  >>,
  requestHeadersInserted string,
  responseCodeSent int,
  httpRequest struct<
    clientIp:string,
    country:string,
    headers:array<struct<name:string,value:string>>,
    uri:string,
    args:string,
    httpVersion:string,
    httpMethod:string,
    requestId:string
  >,
  labels array<struct<name:string>>
)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
LOCATION 's3://my-waf-logs-bucket/AWSLogs/123456789012/WAFLogs/ap-northeast-1/production-web-acl/';

-- Analyze blocked requests
SELECT
  httprequest.clientip,
  httprequest.uri,
  httprequest.country,
  terminatingruleid,
  COUNT(*) as block_count
FROM waf_logs
WHERE action = 'BLOCK'
  AND from_unixtime(timestamp/1000) > current_timestamp - interval '24' hour
GROUP BY 1, 2, 3, 4
ORDER BY block_count DESC
LIMIT 20;

-- Request distribution by country
SELECT
  httprequest.country,
  action,
  COUNT(*) as request_count
FROM waf_logs
WHERE from_unixtime(timestamp/1000) > current_timestamp - interval '7' day
GROUP BY 1, 2
ORDER BY request_count DESC;

-- Details of SQLi/XSS detections
SELECT
  httprequest.clientip,
  httprequest.uri,
  httprequest.httpmethod,
  terminatingruleid,
  terminatingrulematchdetails
FROM waf_logs
WHERE terminatingruleid IN ('AWSManagedRulesSQLiRuleSet', 'CrossSiteScripting_BODY')
  AND from_unixtime(timestamp/1000) > current_timestamp - interval '24' hour
LIMIT 50;

-- IPs blocked by rate-based rule
SELECT
  httprequest.clientip,
  httprequest.country,
  COUNT(*) as blocked_count,
  MIN(from_unixtime(timestamp/1000)) as first_blocked,
  MAX(from_unixtime(timestamp/1000)) as last_blocked
FROM waf_logs
WHERE terminatingruleid = 'RateLimitRule'
  AND from_unixtime(timestamp/1000) > current_timestamp - interval '24' hour
GROUP BY 1, 2
ORDER BY blocked_count DESC
LIMIT 20;
```

### 2.6 CloudWatch Metrics and Alarms

```yaml
# CloudFormation: CloudWatch alarms for WAF
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  # Alarm for sudden spike in block rate
  HighBlockRateAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: waf-high-block-rate
      AlarmDescription: "WAF block rate exceeds threshold"
      Namespace: AWS/WAFV2
      MetricName: BlockedRequests
      Dimensions:
        - Name: WebACL
          Value: production-web-acl
        - Name: Region
          Value: ap-northeast-1
        - Name: Rule
          Value: ALL
      Statistic: Sum
      Period: 300            # 5 minutes
      EvaluationPeriods: 2   # 2 consecutive periods
      Threshold: 1000        # 1000 blocks per 5 minutes
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SecurityAlertTopic

  # Alarm when rate-based rule is triggered
  RateLimitAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: waf-rate-limit-triggered
      AlarmDescription: "Rate limit rule triggered frequently"
      Namespace: AWS/WAFV2
      MetricName: BlockedRequests
      Dimensions:
        - Name: WebACL
          Value: production-web-acl
        - Name: Region
          Value: ap-northeast-1
        - Name: Rule
          Value: RateLimitRule
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 100
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SecurityAlertTopic

  # Anomaly detection for total request volume
  RequestAnomalyAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: waf-request-anomaly
      AlarmDescription: "Unusual request volume detected"
      Namespace: AWS/WAFV2
      MetricName: AllowedRequests
      Dimensions:
        - Name: WebACL
          Value: production-web-acl
        - Name: Region
          Value: ap-northeast-1
        - Name: Rule
          Value: ALL
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 3
      Threshold: 50000
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching
      AlarmActions:
        - !Ref SecurityAlertTopic

  SecurityAlertTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: waf-security-alerts
      Subscription:
        - Protocol: email
          Endpoint: security@example.com
```

### 2.7 Dynamic IP Set Management

```python
import boto3
import json
from datetime import datetime

waf = boto3.client("wafv2", region_name="ap-northeast-1")

def add_ip_to_blocklist(ip_address: str, ip_set_name: str, ip_set_id: str):
    """Add an IP address to the block list"""
    # Retrieve current IP set
    response = waf.get_ip_set(
        Name=ip_set_name,
        Scope="REGIONAL",
        Id=ip_set_id,
    )

    addresses = response["IPSet"]["Addresses"]
    lock_token = response["LockToken"]

    # Convert to CIDR notation
    if "/" not in ip_address:
        ip_address = f"{ip_address}/32"

    if ip_address not in addresses:
        addresses.append(ip_address)

        waf.update_ip_set(
            Name=ip_set_name,
            Scope="REGIONAL",
            Id=ip_set_id,
            Addresses=addresses,
            LockToken=lock_token,
        )
        print(f"Added {ip_address} to blocklist at {datetime.now()}")
    else:
        print(f"{ip_address} already in blocklist")

def remove_ip_from_blocklist(ip_address: str, ip_set_name: str, ip_set_id: str):
    """Remove an IP address from the block list"""
    response = waf.get_ip_set(
        Name=ip_set_name,
        Scope="REGIONAL",
        Id=ip_set_id,
    )

    addresses = response["IPSet"]["Addresses"]
    lock_token = response["LockToken"]

    if "/" not in ip_address:
        ip_address = f"{ip_address}/32"

    if ip_address in addresses:
        addresses.remove(ip_address)

        waf.update_ip_set(
            Name=ip_set_name,
            Scope="REGIONAL",
            Id=ip_set_id,
            Addresses=addresses,
            LockToken=lock_token,
        )
        print(f"Removed {ip_address} from blocklist")

# Auto-block: automatically add attacking IPs from WAF logs
def auto_block_from_logs(threshold: int = 100):
    """Detect attacking IPs via CloudWatch Logs Insights and block them"""
    logs = boto3.client("logs", region_name="ap-northeast-1")

    query = f"""
    fields httprequest.clientip as ip, count(*) as cnt
    | filter action = "BLOCK"
    | stats count(*) as cnt by httprequest.clientip
    | filter cnt > {threshold}
    | sort cnt desc
    | limit 50
    """

    response = logs.start_query(
        logGroupName="aws-waf-logs-production",
        startTime=int((datetime.now().timestamp() - 3600)),  # Past 1 hour
        endTime=int(datetime.now().timestamp()),
        queryString=query,
    )

    # Retrieve query results and block IPs
    import time
    time.sleep(10)

    results = logs.get_query_results(queryId=response["queryId"])
    for result in results.get("results", []):
        ip = None
        cnt = 0
        for field in result:
            if field["field"] == "ip":
                ip = field["value"]
            elif field["field"] == "cnt":
                cnt = int(field["value"])

        if ip and cnt > threshold:
            add_ip_to_blocklist(
                ip, "blocked-ips", "ip-set-id-xxxx"
            )
```

### 2.8 AWS WAF JavaScript SDK (Bot Detection)

```html
<!-- WAF CAPTCHA/Challenge integration -->
<script type="text/javascript"
  src="https://xxxxx.token.awswaf.com/xxxxx/challenge.js"
  defer>
</script>

<script>
// Retrieve and submit WAF Token
async function submitForm() {
  try {
    // Obtain WAF Challenge token
    const token = await AwsWafIntegration.getToken();

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aws-waf-token': token,
      },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });

    const data = await response.json();
    console.log('Login result:', data);
  } catch (error) {
    console.error('WAF challenge failed:', error);
  }
}
</script>
```

---

## 3. AWS Shield

### 3.1 Shield Standard vs Advanced

```
┌──────────────────────────────────────────────────────────┐
│                   Shield Standard                        │
│  (Automatically applied to all AWS accounts — free)      │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │ L3/L4 DDoS Protection                          │      │
│  │ - SYN/UDP Flood                                │      │
│  │ - Reflection attacks                           │      │
│  │ - Automatic mitigation via CloudFront/Route 53 │      │
│  └────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                   Shield Advanced                        │
│  ($3,000/month + data transfer, 1-year commitment)       │
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │ All Standard features +                         │      │
│  │ - L7 DDoS detection and automatic mitigation   │      │
│  │ - DDoS Response Team (DRT) 24/7 support        │      │
│  │ - Cost protection (scale-out costs from DDoS)  │      │
│  │ - Real-time attack visibility                  │      │
│  │ - WAF charges included with Shield Advanced    │      │
│  │ - Health-based detection (Route 53 checks)     │      │
│  │ - Proactive engagement by SRT                  │      │
│  └────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Configuring Shield Advanced

```bash
# Enable Shield Advanced (annual commitment)
aws shield create-subscription

# Add protected resources
aws shield create-protection \
  --name "Production-ALB" \
  --resource-arn "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:loadbalancer/app/prod-alb/xxxx"

aws shield create-protection \
  --name "Production-CloudFront" \
  --resource-arn "arn:aws:cloudfront::123456789012:distribution/EXXXXXXXXXX"

aws shield create-protection \
  --name "Production-EIP" \
  --resource-arn "arn:aws:ec2:ap-northeast-1:123456789012:eip-allocation/eipalloc-xxxx"

# List protections
aws shield list-protections

# Grant DRT access
aws shield associate-drt-role \
  --role-arn "arn:aws:iam::123456789012:role/ShieldDRTAccessRole"

aws shield associate-drt-log-bucket \
  --log-bucket "my-waf-logs-bucket"

# Enable Proactive Engagement
aws shield enable-proactive-engagement

# Configure Emergency Contact
aws shield associate-health-check \
  --protection-id "protection-id-xxxx" \
  --health-check-arn "arn:aws:route53:::healthcheck/xxxx"

aws shield update-emergency-contact-settings \
  --emergency-contact-list '[
    {"EmailAddress": "security@example.com", "PhoneNumber": "+81-90-xxxx-xxxx", "ContactNotes": "Security Team Lead"},
    {"EmailAddress": "oncall@example.com", "PhoneNumber": "+81-80-xxxx-xxxx", "ContactNotes": "On-call Engineer"}
  ]'
```

### 3.3 Monitoring Shield Advanced Events

```python
import boto3
from datetime import datetime, timedelta

def get_ddos_attacks(hours: int = 24) -> list[dict]:
    """Retrieve DDoS attack events from the past N hours"""
    shield = boto3.client("shield", region_name="us-east-1")  # Shield uses us-east-1

    start_time = datetime.utcnow() - timedelta(hours=hours)
    end_time = datetime.utcnow()

    response = shield.list_attacks(
        StartTime={"FromInclusive": start_time, "ToExclusive": end_time},
        MaxResults=100,
    )

    attacks = []
    for attack in response.get("AttackSummaries", []):
        detail = shield.describe_attack(AttackId=attack["AttackId"])
        attack_detail = detail["Attack"]

        attacks.append({
            "AttackId": attack_detail["AttackId"],
            "ResourceArn": attack_detail["ResourceArn"],
            "StartTime": str(attack_detail.get("StartTime")),
            "EndTime": str(attack_detail.get("EndTime")),
            "Vectors": [
                {
                    "VectorType": v["VectorType"],
                    "Counters": [
                        {"Name": c["Name"], "Max": c["Max"], "Average": c["Average"], "Sum": c["Sum"]}
                        for c in v.get("VectorCounters", [])
                    ]
                }
                for v in attack_detail.get("AttackProperties", [])
            ],
            "Mitigations": attack_detail.get("Mitigations", []),
        })

    return attacks

# Execute
attacks = get_ddos_attacks(24)
for attack in attacks:
    print(f"Attack: {attack['AttackId']}")
    print(f"  Resource: {attack['ResourceArn']}")
    print(f"  Duration: {attack['StartTime']} - {attack['EndTime']}")
    for vector in attack["Vectors"]:
        print(f"  Vector: {vector['VectorType']}")
```

---

## 4. Multi-Layered Defense Architecture

### 4.1 Complete Defense Configuration

```
Internet
    │
    ▼
┌──────────────────┐
│ Route 53         │  ← Shield Standard (DNS DDoS protection)
│ (DNS)            │     DNSSEC enabled
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ CloudFront       │  ← Shield Standard/Advanced + WAF
│ (CDN + Edge WAF) │     Geo Restriction
│                  │     Origin Access Control
│                  │     TLS 1.2+ enforced
└────────┬─────────┘
         │ Origin Access (signed requests)
         ▼
┌──────────────────┐
│ ALB              │  ← WAF (Regional) + Security Group
│ (Load Balancer)  │     Request validation
│                  │     SG: allow only CloudFront Prefix List
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ ECS / EC2        │  ← Security Group (ALB only)
│ (Application)    │     Application-side validation
│                  │     OWASP Top 10 countermeasures
└──────────────────┘
```

### 4.2 Two-Stage WAF Configuration with CloudFront + ALB

```yaml
# CloudFront WAF (edge protection)
AWSTemplateFormatVersion: "2010-09-09"
Resources:
  # Edge WAF (must be created in us-east-1)
  EdgeWebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: edge-web-acl
      Scope: CLOUDFRONT
      DefaultAction:
        Allow: {}
      Rules:
        # Geo restriction (early block at edge)
        - Name: GeoBlock
          Priority: 0
          Action:
            Block: {}
          Statement:
            NotStatement:
              Statement:
                GeoMatchStatement:
                  CountryCodes: ["JP", "US", "SG"]  # Allow only these countries
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: GeoBlock
            SampledRequestsEnabled: true

        # IP reputation
        - Name: AmazonIPReputation
          Priority: 1
          OverrideAction:
            None: {}
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesAmazonIpReputationList
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: IPReputation
            SampledRequestsEnabled: true

        # Anonymous IP (VPN/Tor)
        - Name: AnonymousIP
          Priority: 2
          OverrideAction:
            Count: {}    # Start with Count to observe
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesAnonymousIpList
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: AnonymousIP
            SampledRequestsEnabled: true

        # Global rate limit
        - Name: GlobalRateLimit
          Priority: 3
          Action:
            Block: {}
          Statement:
            RateBasedStatement:
              Limit: 5000    # Overall limit at edge
              AggregateKeyType: IP
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: GlobalRateLimit
            SampledRequestsEnabled: true
      VisibilityConfig:
        CloudWatchMetricsEnabled: true
        MetricName: edge-web-acl
        SampledRequestsEnabled: true
```

### 4.3 ALB Security Group Configuration

```bash
# Use CloudFront managed prefix list
aws ec2 describe-managed-prefix-lists \
  --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing

# ALB security group: allow only from CloudFront
aws ec2 authorize-security-group-ingress \
  --group-id sg-alb-xxxx \
  --ip-permissions '[
    {
      "IpProtocol": "tcp",
      "FromPort": 443,
      "ToPort": 443,
      "PrefixListIds": [
        {"PrefixListId": "pl-3b927c52"}
      ]
    }
  ]'

# Validate with CloudFront custom header
# Add custom header from CloudFront to ALB
# Validate header in ALB listener rules
```

---

## 5. Full WAF Configuration with CDK

### 5.1 WAF Stack in CDK

```typescript
import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // IP block list
    const blockedIpSet = new wafv2.CfnIPSet(this, 'BlockedIPs', {
      name: 'blocked-ips',
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: [],
    });

    // Admin allowed IP set
    const adminIpSet = new wafv2.CfnIPSet(this, 'AdminIPs', {
      name: 'admin-allowed-ips',
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: ['203.0.113.0/24', '198.51.100.10/32'],
    });

    // Web ACL
    this.webAcl = new wafv2.CfnWebACL(this, 'WebACL', {
      name: 'production-web-acl',
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'production-web-acl',
        sampledRequestsEnabled: true,
      },
      rules: [
        // IP block list
        {
          name: 'IPBlockList',
          priority: 0,
          action: { block: {} },
          statement: {
            ipSetReferenceStatement: { arn: blockedIpSet.attrArn },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'IPBlockList',
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed Rules: Common
        {
          name: 'AWSCommonRules',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'CommonRules',
            sampledRequestsEnabled: true,
          },
        },
        // AWS Managed Rules: SQLi
        {
          name: 'AWSSQLiRules',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'SQLiRules',
            sampledRequestsEnabled: true,
          },
        },
        // Rate limit
        {
          name: 'RateLimit',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // CloudWatch alarm
    const alertTopic = new sns.Topic(this, 'WafAlerts', {
      topicName: 'waf-security-alerts',
    });

    new cloudwatch.Alarm(this, 'HighBlockRate', {
      alarmName: 'waf-high-block-rate',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/WAFV2',
        metricName: 'BlockedRequests',
        dimensionsMap: {
          WebACL: 'production-web-acl',
          Region: this.region,
          Rule: 'ALL',
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1000,
      evaluationPeriods: 2,
    });
  }
}
```

---

## 6. Comparison Tables

### 6.1 WAF Managed Rule Group Comparison

| Rule Group | Protection Target | WCU | Recommendation |
|--------------|---------|-----|------|
| **AWSManagedRulesCommonRuleSet** | XSS, path traversal, file injection | 700 | Required for all apps |
| **AWSManagedRulesSQLiRuleSet** | SQL injection | 200 | Required for DB apps |
| **AWSManagedRulesKnownBadInputsRuleSet** | Log4j, known vulnerabilities | 200 | Required for Java apps |
| **AWSManagedRulesBotControlRuleSet** | Bot detection and control | 50 | Recommended for e-commerce |
| **AWSManagedRulesATPRuleSet** | Account takeover prevention | 50 | Apps with authentication |
| **AWSManagedRulesAnonymousIPList** | VPN/Tor/proxy | 50 | Security-focused apps |
| **AWSManagedRulesAmazonIpReputationList** | Malicious IPs | 25 | Recommended for all apps |
| **AWSManagedRulesLinuxRuleSet** | Linux-specific attacks | 200 | Linux environments |
| **AWSManagedRulesWindowsRuleSet** | Windows-specific attacks | 200 | Windows environments |
| **AWSManagedRulesPHPRuleSet** | PHP-specific attacks | 100 | PHP apps |
| **AWSManagedRulesWordPressRuleSet** | WordPress-specific attacks | 100 | WordPress |

### 6.2 DDoS Protection Layer Comparison

| Layer | Attack Examples | Protection Service | Auto/Manual |
|---------|--------|-------------|----------|
| **L3 (Network)** | UDP Flood, ICMP Flood | Shield Standard | Automatic |
| **L4 (Transport)** | SYN Flood, TCP RST | Shield Standard | Automatic |
| **L7 (Application)** | HTTP Flood, Slowloris | WAF + Shield Advanced | Rule configuration required |
| **DNS** | DNS Query Flood | Route 53 + Shield | Automatic |
| **API** | API call flooding | API Gateway Throttling + WAF | Configuration required |

### 6.3 Shield Standard vs Advanced Detailed Comparison

| Feature | Shield Standard | Shield Advanced |
|------|----------------|----------------|
| **Pricing** | Free | $3,000/month + data transfer |
| **L3/L4 Protection** | Automatic | Automatic + advanced detection |
| **L7 Protection** | None | Automatic mitigation via WAF integration |
| **DRT Support** | None | 24/7 availability |
| **Cost Protection** | None | Covers scale-out costs caused by DDoS |
| **Attack Visibility** | Basic | Real-time dashboard |
| **WAF Charges** | Separate | Included with Shield Advanced |
| **Health Check Integration** | None | Route 53 health checks |
| **Proactive Engagement** | None | Pre-emptive response by DRT |
| **Covered Resources** | CloudFront, Route53 | ALB, EIP, CloudFront, Route53, GA |

---

## 7. Anti-Patterns

### 7.1 Leaving WAF Rules in Count Mode Indefinitely

```
BAD: Start in Count mode at launch → leave it for months
    → Only logging attacks, not blocking them

GOOD: Phased migration process
    Week 1-2: Monitor false positives in Count mode
    Week 3:   Add false positive rules to ExcludedRules
    Week 4:   Switch to Block mode
    Ongoing:  Monitor block rate with CloudWatch alarms
```

**Mitigation**: Incorporate a Count mode evaluation period into the project plan and define the criteria for switching to Block mode in advance.

### 7.2 Applying WAF Only to ALB Without CloudFront

```
BAD:
  Client → ALB (WAF) → App
  Problem: DDoS hits ALB directly, origin IP is exposed

GOOD:
  Client → CloudFront (WAF + Shield) → ALB (SG: CloudFront only) → App
  Benefit: Attack mitigation at edge, direct access to ALB blocked
```

**Mitigation**: Restrict the ALB security group to allow only CloudFront IP ranges, blocking direct access. The CloudFront IP list published by AWS can be referenced via AWS Managed Prefix List.

### 7.3 Unconditionally Applying All Managed Rules

```
BAD:
  Apply all managed rules in Block mode at once
  → Legitimate requests get blocked (false positives)
  → WCU limit reached

GOOD:
  Phased adoption:
  1. Apply Common + SQLi in Count mode first
  2. Monitor logs for 1-2 weeks to check for false positives
  3. Exclude false positive rules via ExcludedRules
  4. Switch to Block mode
  5. Add the next rule group
```

### 7.4 Not Storing or Analyzing WAF Logs

```
BAD:
  WAF logging not enabled
  → Cannot understand attack trends
  → Cannot investigate false positive causes

GOOD:
  Analyze WAF logs with S3 + Athena
  → Regularly review blocked request trends
  → Visualize attack status on a dashboard
  → Detect anomalies with automated alerts
```

### 7.5 Rate Limits That Are Too Loose or Too Strict

```
BAD:
  Apply a uniform rate limit of 10,000 req/5min to all endpoints
  → Cannot prevent brute force on login pages
  → Normal API usage gets blocked

GOOD:
  Per-endpoint rate limits:
  - /api/login    → 100 req/5min (strict)
  - /api/signup   → 50 req/5min (strict)
  - /api/data     → 5000 req/5min (normal)
  - Global        → 10000 req/5min (overall safety valve)
```

---

## 8. FAQ

### Q1. How do I handle the WAF WCU (Web ACL Capacity Unit) limit?

**A.** The default limit for a Web ACL is 5,000 WCU. Check the WCU of each managed rule and remove unnecessary rule groups, or use scope-down statements to narrow the scope of rule application. If still insufficient, you can request a limit increase from AWS Support.

### Q2. How quickly do WAF rule changes take effect?

**A.** For REGIONAL scope (ALB/API Gateway), changes typically propagate within a few seconds to one minute. For CLOUDFRONT scope, propagation to edge locations may take a few minutes. It is recommended to pre-test using Count mode in production environments.

### Q3. Is Shield Advanced really worth $3,000/month?

**A.** It is worth considering if any of the following apply:
- Revenue loss from DDoS attacks could exceed $3,000/month
- 24/7 DDoS Response Team support is required
- Protection from scale-out costs due to DDoS is needed
- WAF is used at large scale and the WAF cost savings justify it

For small to mid-sized services, the combination of Shield Standard + WAF + CloudFront is often sufficient.

### Q4. What should I do when WAF false positives occur?

**A.** (1) Identify the terminatingRuleId of the relevant request from WAF logs, (2) add the rule to ExcludedRules or switch it to Count mode, (3) use a scope-down statement to limit the scope if needed (e.g., specific paths only), (4) implement alternative protection with a custom rule. If false positives are frequent, use rule labels for more granular control.

### Q5. What is the criteria for choosing between WAF on API Gateway vs ALB?

**A.** WAF can be applied directly to API Gateway REST APIs. The same applies to ALBs. When CloudFront is placed in front, CloudFront's WAF becomes the first line of defense. The recommended configuration is a two-stage setup: CloudFront (WAF: geo restriction/IP restriction/rate limiting) + ALB (WAF: SQLi/XSS/application-specific rules). When using API Gateway, combine its WAF with API keys and Usage Plans for additional protection.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is most important. Rather than theory alone, understanding deepens by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## 9. Summary

| Item | Key Points |
|------|---------|
| **AWS WAF** | Evaluate rules via Web ACL; use managed rules to immediately defend against common attacks |
| **Shield Standard** | Free for all accounts; automatic L3/L4 DDoS protection |
| **Shield Advanced** | $3,000/month; L7 DDoS support, DRT support, cost protection |
| **Multi-layered defense** | Two-stage WAF with CloudFront (Edge) + ALB (Regional) is ideal |
| **Rule design** | Combine managed rules with custom rules; apply per-endpoint rate limits |
| **Operations** | Phased Count → Block migration; monitor block rate with CloudWatch |
| **Log analysis** | Analyze block patterns with S3 + Athena; automated alerts via EventBridge |
| **IaC** | Manage WAF configuration as code with CDK/Terraform for consistency across environments |

---

## Further Reading

- [01-secrets-management.md](./01-secrets-management.md) — Protect sensitive information with secret management
- [00-iam-deep-dive.md](./00-iam-deep-dive.md) — IAM policy design guide
- VPC Security Guide — Network-layer defense

---

## References

1. **AWS Official Documentation** — "AWS WAF Developer Guide" — https://docs.aws.amazon.com/waf/latest/developerguide/
2. **AWS Official Documentation** — "AWS Shield Developer Guide" — https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html
3. **AWS Official Blog** — "Defending common web attacks using AWS WAF" — https://aws.amazon.com/blogs/security/
4. **AWS Well-Architected Framework** — Security Pillar — "Infrastructure protection" — https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/
5. **AWS WAF Security Automations** — "AWS WAF Security Automations Solution" — https://aws.amazon.com/solutions/implementations/aws-waf-security-automations/
6. **OWASP Top 10** — "OWASP Top 10 Web Application Security Risks" — https://owasp.org/www-project-top-ten/
