# Amazon Route 53

> Understand AWS's fully managed DNS service and build highly available architectures leveraging domain management, routing policies, and health checks

## What You Will Learn in This Chapter

1. **Route 53 Fundamentals** -- Hosted zones, record types, and how DNS resolution works
2. **Routing Policies** -- Simple, weighted, latency, failover, and geolocation routing
3. **Health Checks and DNS Failover** -- Endpoint monitoring and automatic switchover
4. **Domain Management** -- Domain registration, transfers, and DNSSEC configuration
5. **Traffic Flow** -- Advanced routing design with the visual editor
6. **Resolver** -- Hybrid DNS and on-premises integration


## Prerequisites

Before reading this guide, having the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content in [Amazon VPC Basics](./00-vpc-basics.md)

---

## 1. What Is Route 53

Route 53 is AWS's scalable DNS service that provides three functions: domain registration, DNS routing, and health checks. It is the only AWS service with a 100% availability SLA.

### Diagram 1: DNS Resolution Flow

```
User accesses www.example.com:

  Browser
    |
    v
  +--------------------+
  | Local DNS           | <-- Returns immediately if cached
  | Resolver            |
  +--------+-----------+
           | Cache miss
           v
  +--------------------+
  | Root DNS            | --> Returns authoritative server for .com
  | Server (.)          |
  +--------+-----------+
           v
  +--------------------+
  | TLD DNS Server      | --> Returns NS for example.com
  | (.com)              |
  +--------+-----------+
           v
  +--------------------+
  | Route 53            | --> Returns IP for www.example.com
  | (Authoritative DNS) |    (Based on routing policy)
  |                     |
  | Hosted Zone:        |
  | example.com         |
  +--------+-----------+
           |
           v
  Browser connects via IP --> ALB/CloudFront/EC2
```

### Route 53 Pricing

| Item | Price |
|------|-------|
| Hosted Zone | $0.50/month (first 25 zones) |
| DNS Queries (Standard) | $0.40/million queries |
| DNS Queries (Alias) | Free (for AWS resources) |
| DNS Queries (Latency) | $0.60/million queries |
| DNS Queries (Geo) | $0.70/million queries |
| Health Check (Basic) | $0.50/month |
| Health Check (HTTPS) | $0.75/month |
| Health Check (with String Matching) | $1.00/month |
| Domain Registration (.com) | ~$13/year |

---

## 2. Hosted Zones and Records

### Public vs Private Hosted Zones

```
Public Hosted Zone:
======================
  DNS resolution available from anywhere on the internet
  example.com --> 203.0.113.10

Private Hosted Zone:
========================
  DNS resolution available only from within the VPC
  internal.example.com --> 10.0.1.50

  Can associate multiple VPCs:
  +---------------------------------------+
  | Private Hosted Zone                   |
  | internal.example.com                  |
  |                                       |
  |  +--- VPC-A (ap-northeast-1)         |
  |  +--- VPC-B (ap-northeast-1)         |
  |  +--- VPC-C (us-east-1)             |
  +---------------------------------------+
```

### Code Example 1: Creating a Hosted Zone

```bash
# Create a public hosted zone
aws route53 create-hosted-zone \
  --name example.com \
  --caller-reference "$(date +%s)" \
  --hosted-zone-config Comment="Production zone"

# Create a private hosted zone (for internal VPC use)
aws route53 create-hosted-zone \
  --name internal.example.com \
  --caller-reference "$(date +%s)" \
  --vpc VPCRegion=ap-northeast-1,VPCId=vpc-0abc1234 \
  --hosted-zone-config Comment="Internal DNS",PrivateZone=true

# Associate an additional VPC with the private hosted zone
aws route53 associate-vpc-with-hosted-zone \
  --hosted-zone-id Z0123456789ABCDEF \
  --vpc VPCRegion=ap-northeast-1,VPCId=vpc-0def5678

# List hosted zones
aws route53 list-hosted-zones \
  --query 'HostedZones[*].{Name:Name,Id:Id,Private:Config.PrivateZone}' \
  --output table

# List records in a hosted zone
aws route53 list-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --output table
```

### Code Example 2: Registering DNS Records

```bash
# A record (ALB Alias)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "my-alb-1234567890.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# AAAA record (IPv6 Alias)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "AAAA",
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "my-alb-1234567890.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# MX record (Mail)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "example.com",
        "Type": "MX",
        "TTL": 3600,
        "ResourceRecords": [
          {"Value": "10 mail1.example.com"},
          {"Value": "20 mail2.example.com"}
        ]
      }
    }]
  }'

# TXT record (SPF/DKIM)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "example.com",
        "Type": "TXT",
        "TTL": 300,
        "ResourceRecords": [
          {"Value": "\"v=spf1 include:_spf.google.com ~all\""}
        ]
      }
    }]
  }'

# CNAME record (External service)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "blog.example.com",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {"Value": "example-blog.netlify.app"}
        ]
      }
    }]
  }'

# CAA record (Certificate Authority restriction)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "example.com",
        "Type": "CAA",
        "TTL": 3600,
        "ResourceRecords": [
          {"Value": "0 issue \"amazon.com\""},
          {"Value": "0 issue \"letsencrypt.org\""},
          {"Value": "0 issuewild \"amazon.com\""},
          {"Value": "0 iodef \"mailto:security@example.com\""}
        ]
      }
    }]
  }'

# Batch change of multiple records
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Comment": "Initial DNS setup",
    "Changes": [
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "example.com",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z2FDTNDATAQYW2",
            "DNSName": "d111111abcdef8.cloudfront.net",
            "EvaluateTargetHealth": false
          }
        }
      },
      {
        "Action": "CREATE",
        "ResourceRecordSet": {
          "Name": "api.example.com",
          "Type": "A",
          "AliasTarget": {
            "HostedZoneId": "Z14GRHDCWA56QT",
            "DNSName": "api-alb-1234.ap-northeast-1.elb.amazonaws.com",
            "EvaluateTargetHealth": true
          }
        }
      }
    ]
  }'
```

### Record Type Reference

```
+----------+--------------------------------------+
| Record   | Purpose                              |
+----------+--------------------------------------+
| A        | IPv4 address                         |
| AAAA     | IPv6 address                         |
| CNAME    | Redirect to another domain           |
|          | (not allowed at Zone Apex)           |
| Alias    | Alias to AWS resource (recommended)  |
| MX       | Mail server                          |
| TXT      | Text (SPF, DKIM, verification)       |
| NS       | Name server                          |
| SOA      | Zone management information          |
| SRV      | Service location                     |
| CAA      | Certificate Authority restriction    |
| NAPTR    | Name Authority Pointer               |
| DS       | DNSSEC Delegation Signer             |
+----------+--------------------------------------+
```

---

## 3. Routing Policies

### Diagram 2: Routing Policy Comparison

```
1. Simple:
   DNS Query --> Returns a single value (random if multiple values)

2. Weighted:
   DNS Query --> Distributes based on weight
   +-- 70% --> us-east-1 (v2)
   +-- 30% --> us-east-1 (v1)   <-- Ideal for canary deployments

3. Latency:
   DNS Query --> Routes to the region with lowest latency
   Tokyo user --> ap-northeast-1
   US user --> us-east-1

4. Failover:
   DNS Query --> Primary if healthy, Secondary if unhealthy
   +-- Primary (ap-northeast-1)  <-- Health check OK
   +-- Secondary (us-west-2)     <-- Switches when Primary is unhealthy

5. Geolocation:
   DNS Query --> Routes based on user's geographic location
   Japan --> ap-northeast-1
   US --> us-east-1
   Default --> eu-west-1

6. Multivalue Answer:
   DNS Query --> Returns up to 8 healthy records
   * Simple load balancing with health checks

7. Geoproximity:
   DNS Query --> Adjusts geographic range with bias values
   * Only available with Traffic Flow

8. IP-based:
   DNS Query --> Routes based on client IP CIDR range
   * Used for ISP-specific optimal routing, etc.
```

### Code Example 3: Weighted Routing (Canary Deployment)

```bash
# Set 90% weight for v2 (new version)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "v2-primary",
        "Weight": 90,
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-v2.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Set 10% weight for v1 (old version)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "v1-canary",
        "Weight": 10,
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-v1.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Gradual weight change for canary deployment
# Phase 1: 90/10 --> Phase 2: 70/30 --> Phase 3: 0/100
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "v2-primary",
        "Weight": 0,
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-v2.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "v1-canary",
        "Weight": 100,
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-v1.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

### Code Example 3b: Latency Routing

```bash
# Tokyo region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "tokyo",
        "Region": "ap-northeast-1",
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-tokyo.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Virginia region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "virginia",
        "Region": "us-east-1",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "alb-virginia.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Frankfurt region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "frankfurt",
        "Region": "eu-central-1",
        "AliasTarget": {
          "HostedZoneId": "Z215JYRZR1TBD5",
          "DNSName": "alb-frankfurt.eu-central-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

### Code Example 4: Failover Routing

```bash
# Create a health check
aws route53 create-health-check \
  --caller-reference "primary-$(date +%s)" \
  --health-check-config '{
    "IPAddress": "203.0.113.1",
    "Port": 443,
    "Type": "HTTPS",
    "ResourcePath": "/health",
    "RequestInterval": 10,
    "FailureThreshold": 3,
    "EnableSNI": true,
    "FullyQualifiedDomainName": "api.example.com"
  }'
# --> HealthCheckId: hc-primary-001

# Primary record
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
        "HealthCheckId": "hc-primary-001",
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-primary.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Secondary record (DR region)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "SetIdentifier": "secondary",
        "Failover": "SECONDARY",
        "AliasTarget": {
          "HostedZoneId": "Z1H1FL5HABSF5",
          "DNSName": "alb-dr.us-west-2.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Use S3 static website as Secondary (maintenance page)
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "A",
        "SetIdentifier": "maintenance",
        "Failover": "SECONDARY",
        "AliasTarget": {
          "HostedZoneId": "Z2M4EHUR26P7ZW",
          "DNSName": "s3-website-ap-northeast-1.amazonaws.com",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### Code Example 4b: Geolocation Routing

```bash
# Access from Japan --> Tokyo region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "A",
        "SetIdentifier": "japan",
        "GeoLocation": {
          "CountryCode": "JP"
        },
        "AliasTarget": {
          "HostedZoneId": "Z14GRHDCWA56QT",
          "DNSName": "alb-tokyo.ap-northeast-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Access from the US --> Virginia region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "A",
        "SetIdentifier": "us",
        "GeoLocation": {
          "CountryCode": "US"
        },
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "alb-virginia.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'

# Default (other regions) --> Frankfurt region
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.example.com",
        "Type": "A",
        "SetIdentifier": "default",
        "GeoLocation": {
          "CountryCode": "*"
        },
        "AliasTarget": {
          "HostedZoneId": "Z215JYRZR1TBD5",
          "DNSName": "alb-frankfurt.eu-central-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }]
  }'
```

---

## 4. Health Checks

### Diagram 3: Types of Health Checks

```
1. Endpoint Health Check:
   Route 53 ---> HTTPS GET /health ---> App
                     |
                     +-- 2xx/3xx --> Healthy
                     +-- Timeout/5xx --> Unhealthy

   * Monitored from 15+ health checkers worldwide
   * Overall Healthy if 18%+ of checkers report Healthy

2. Calculated Health Check:
   +-- HC-1 (us-east-1)  --> Healthy --+
   +-- HC-2 (eu-west-1)  --> Healthy --+--> AND/OR --> Overall result
   +-- HC-3 (ap-ne-1)    --> Unhealthy-+

3. CloudWatch Alarm Health Check:
   CloudWatch Alarm --> Route 53 Health Check
   (Used for monitoring internal resources like DynamoDB, Lambda, etc.)
```

### Code Example 5: Various Health Check Configurations

```bash
# HTTPS endpoint health check (with string matching)
aws route53 create-health-check \
  --caller-reference "api-health-$(date +%s)" \
  --health-check-config '{
    "Type": "HTTPS_STR_MATCH",
    "FullyQualifiedDomainName": "api.example.com",
    "Port": 443,
    "ResourcePath": "/health",
    "SearchString": "\"status\":\"ok\"",
    "RequestInterval": 10,
    "FailureThreshold": 3,
    "EnableSNI": true,
    "Regions": ["us-east-1", "eu-west-1", "ap-southeast-1"]
  }'

# TCP health check (for databases, etc.)
aws route53 create-health-check \
  --caller-reference "db-health-$(date +%s)" \
  --health-check-config '{
    "Type": "TCP",
    "IPAddress": "10.0.1.50",
    "Port": 5432,
    "RequestInterval": 30,
    "FailureThreshold": 3
  }'

# Calculated health check (combination of child health checks)
aws route53 create-health-check \
  --caller-reference "calculated-$(date +%s)" \
  --health-check-config '{
    "Type": "CALCULATED",
    "ChildHealthChecks": [
      "hc-api-001",
      "hc-db-001",
      "hc-cache-001"
    ],
    "HealthThreshold": 2
  }'

# CloudWatch alarm-based health check
aws route53 create-health-check \
  --caller-reference "cw-alarm-$(date +%s)" \
  --health-check-config '{
    "Type": "CLOUDWATCH_METRIC",
    "AlarmIdentifier": {
      "Region": "ap-northeast-1",
      "Name": "API-5xx-Error-Rate"
    },
    "InsufficientDataHealthStatus": "Unhealthy"
  }'

# Tag a health check
aws route53 change-tags-for-resource \
  --resource-type healthcheck \
  --resource-id hc-api-001 \
  --add-tags Key=Name,Value="API Health Check" Key=Environment,Value=production

# Check health check status
aws route53 get-health-check-status \
  --health-check-id hc-api-001 \
  --query 'HealthCheckObservations[*].{Region:Region,Status:StatusReport.Status}'
```

### Code Example 6: Failover with Health Checks in Terraform

```hcl
# Health check
resource "aws_route53_health_check" "primary" {
  fqdn              = "api.example.com"
  port               = 443
  type               = "HTTPS"
  resource_path      = "/health"
  failure_threshold  = 3
  request_interval   = 10

  regions = [
    "us-east-1",
    "eu-west-1",
    "ap-southeast-1",
  ]

  tags = {
    Name = "primary-health-check"
  }
}

# CloudWatch alarm-based health check
resource "aws_route53_health_check" "cloudwatch" {
  type                            = "CLOUDWATCH_METRIC"
  cloudwatch_alarm_name           = aws_cloudwatch_metric_alarm.api_error.alarm_name
  cloudwatch_alarm_region         = "ap-northeast-1"
  insufficient_data_health_status = "Unhealthy"
}

# Calculated health check
resource "aws_route53_health_check" "calculated" {
  type                   = "CALCULATED"
  child_health_threshold = 2
  child_healthchecks = [
    aws_route53_health_check.primary.id,
    aws_route53_health_check.cloudwatch.id,
  ]

  tags = {
    Name = "calculated-health-check"
  }
}

# Primary record
resource "aws_route53_record" "primary" {
  zone_id         = aws_route53_zone.main.zone_id
  name            = "api.example.com"
  type            = "A"
  set_identifier  = "primary"
  health_check_id = aws_route53_health_check.primary.id

  failover_routing_policy {
    type = "PRIMARY"
  }

  alias {
    name                   = aws_lb.primary.dns_name
    zone_id                = aws_lb.primary.zone_id
    evaluate_target_health = true
  }
}

# Secondary record
resource "aws_route53_record" "secondary" {
  zone_id        = aws_route53_zone.main.zone_id
  name           = "api.example.com"
  type           = "A"
  set_identifier = "secondary"

  failover_routing_policy {
    type = "SECONDARY"
  }

  alias {
    name                   = aws_lb.secondary.dns_name
    zone_id                = aws_lb.secondary.zone_id
    evaluate_target_health = true
  }
}

# Latency routing (multi-region)
resource "aws_route53_record" "latency_tokyo" {
  zone_id        = aws_route53_zone.main.zone_id
  name           = "global.example.com"
  type           = "A"
  set_identifier = "tokyo"

  latency_routing_policy {
    region = "ap-northeast-1"
  }

  alias {
    name                   = aws_lb.tokyo.dns_name
    zone_id                = aws_lb.tokyo.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "latency_virginia" {
  zone_id        = aws_route53_zone.main.zone_id
  name           = "global.example.com"
  type           = "A"
  set_identifier = "virginia"

  latency_routing_policy {
    region = "us-east-1"
  }

  alias {
    name                   = aws_lb.virginia.dns_name
    zone_id                = aws_lb.virginia.zone_id
    evaluate_target_health = true
  }
}
```

---

## 5. Routing Policy Comparison

### Comparison Table 1: Routing Policy Selection

| Policy | Use Case | Health Check | Complexity |
|--------|----------|--------------|------------|
| **Simple** | Single resource | None | Low |
| **Weighted** | Canary / A-B testing | Supported | Low |
| **Latency** | Multi-region optimization | Supported | Medium |
| **Failover** | Active-Passive DR | Required | Medium |
| **Geolocation** | Regional restrictions / compliance | Supported | Medium |
| **Multivalue** | Simple load balancing | Supported | Low |
| **Geoproximity** | Geographic range adjustment | Supported | High |
| **IP-based** | ISP / network optimization | Supported | High |

### Comparison Table 2: Alias vs CNAME

| Item | Alias | CNAME |
|------|-------|-------|
| **Zone Apex Support** | Yes (example.com) | No |
| **DNS Query Charges** | Free (for AWS resources) | Charged |
| **Health Check** | Linked via EvaluateTargetHealth | Separate configuration |
| **Target** | ALB, CloudFront, S3, API GW, etc. | Any domain |
| **TTL** | Automatically managed by AWS | Manually configured |
| **Recommendation** | Always use Alias for AWS resources | External services only |

### Alias Hosted Zone IDs for AWS Resources

```
Alias Target HostedZoneIds for Major Services:
=============================================

CloudFront:       Z2FDTNDATAQYW2 (same across all regions)
API Gateway:      Varies by region
S3 Website:       Varies by region

ALB/NLB:
  ap-northeast-1: Z14GRHDCWA56QT
  us-east-1:      Z35SXDOTRQ7X7K
  us-west-2:      Z1H1FL5HABSF5
  eu-west-1:      Z32O12XQLNTSW2
  eu-central-1:   Z215JYRZR1TBD5
```

---

## 6. DNSSEC

DNSSEC (DNS Security Extensions) is a security extension for verifying the authenticity of DNS responses.

```bash
# Enable DNSSEC
# Step 1: Create a KSK (Key Signing Key)
aws route53 create-key-signing-key \
  --hosted-zone-id Z1234567890 \
  --name my-ksk-key \
  --key-management-service-arn arn:aws:kms:us-east-1:123456789012:key/xxx-xxx \
  --status ACTIVE

# Step 2: Enable DNSSEC signing
aws route53 enable-hosted-zone-dnssec \
  --hosted-zone-id Z1234567890

# Step 3: Register the DS record with the parent zone (registrar)
# For domains registered with Route 53:
aws route53domains enable-domain-transfer-lock \
  --domain-name example.com

# Check DNSSEC status
aws route53 get-dnssec \
  --hosted-zone-id Z1234567890
```

---

## 7. Route 53 Resolver

Enables DNS resolution in hybrid environments.

```
Route 53 Resolver Architecture:
====================================

On-Premises DNS                      AWS VPC
+------------------+                  +------------------+
|                  |                  |                  |
| Corporate DNS    |  <-- Outbound   | Route 53         |
| (10.0.0.53)     |       Endpoint   | Resolver         |
|                  |                  |                  |
|                  |  --> Inbound    |                  |
|                  |       Endpoint   |                  |
+------------------+                  +------------------+

Inbound Endpoint:  On-premises --> AWS DNS resolution
Outbound Endpoint: AWS --> On-premises DNS resolution
Resolver Rules:    Conditional forwarding rules
```

```bash
# Create an Inbound Endpoint (for DNS resolution from on-premises)
aws route53resolver create-resolver-endpoint \
  --creator-request-id "inbound-$(date +%s)" \
  --name "inbound-resolver" \
  --security-group-ids sg-0abc123 \
  --direction INBOUND \
  --ip-addresses SubnetId=subnet-0123,Ip=10.0.1.10 SubnetId=subnet-0456,Ip=10.0.2.10

# Create an Outbound Endpoint (for DNS resolution from AWS to on-premises)
aws route53resolver create-resolver-endpoint \
  --creator-request-id "outbound-$(date +%s)" \
  --name "outbound-resolver" \
  --security-group-ids sg-0abc123 \
  --direction OUTBOUND \
  --ip-addresses SubnetId=subnet-0123 SubnetId=subnet-0456

# Create a forwarding rule (forward specific domains to on-premises)
aws route53resolver create-resolver-rule \
  --creator-request-id "forward-$(date +%s)" \
  --name "forward-to-onprem" \
  --rule-type FORWARD \
  --domain-name "corp.internal" \
  --resolver-endpoint-id rslvr-out-xxx \
  --target-ips Ip=10.0.0.53,Port=53

# Associate the rule with a VPC
aws route53resolver associate-resolver-rule \
  --resolver-rule-id rslvr-rr-xxx \
  --vpc-id vpc-0abc1234
```

### Code Example 7: Resolver Terraform Definition

```hcl
resource "aws_route53_resolver_endpoint" "inbound" {
  name               = "inbound-resolver"
  direction          = "INBOUND"
  security_group_ids = [aws_security_group.resolver.id]

  ip_address {
    subnet_id = aws_subnet.private_a.id
    ip        = "10.0.1.10"
  }

  ip_address {
    subnet_id = aws_subnet.private_c.id
    ip        = "10.0.2.10"
  }

  tags = { Name = "inbound-resolver" }
}

resource "aws_route53_resolver_endpoint" "outbound" {
  name               = "outbound-resolver"
  direction          = "OUTBOUND"
  security_group_ids = [aws_security_group.resolver.id]

  ip_address {
    subnet_id = aws_subnet.private_a.id
  }

  ip_address {
    subnet_id = aws_subnet.private_c.id
  }

  tags = { Name = "outbound-resolver" }
}

resource "aws_route53_resolver_rule" "forward_to_onprem" {
  domain_name          = "corp.internal"
  name                 = "forward-to-onprem"
  rule_type            = "FORWARD"
  resolver_endpoint_id = aws_route53_resolver_endpoint.outbound.id

  target_ip {
    ip   = "10.0.0.53"
    port = 53
  }

  target_ip {
    ip   = "10.0.0.54"
    port = 53
  }
}

resource "aws_route53_resolver_rule_association" "forward" {
  resolver_rule_id = aws_route53_resolver_rule.forward_to_onprem.id
  vpc_id           = aws_vpc.main.id
}
```

---

## 8. Route 53 Profiles

A feature for centrally managing DNS settings across multiple accounts/VPCs.

```
Route 53 Profiles:
==================

Profile
  +-- DNS Firewall Rule Group Association
  +-- Private Hosted Zone Association
  +-- Resolver Rule Association

  --> Associate a single Profile with multiple VPCs
  --> Shareable across entire AWS Organizations
  --> Ensures consistency of DNS settings
```

---

## 9. Anti-Patterns

### Anti-Pattern 1: Setting Extremely Short TTLs

```
[Bad Example]
  TTL = 5 seconds (all records)
  --> DNS queries increase, raising costs
  --> Increased load on DNS resolvers
  --> Slight increase in user latency

[Good Example]
  Normal records:    TTL = 300 seconds (5 minutes)
  Failover:          TTL = 60 seconds (1 minute)
  During migration:  TTL = 60 seconds --> Restore to 300 seconds after migration

  Key Points:
  - Lower TTL before migration (2x the old TTL duration in advance)
  - Restore TTL after migration is complete
  - Alias records have automatically managed TTL
```

### Anti-Pattern 2: Failover Without Health Checks

```
[Bad Example]
  Primary --> ALB (no health check)
  Secondary --> S3 Static Site

  Failover does not trigger even when Primary ALB is unhealthy
  --> Users continue seeing error pages

[Good Example]
  Primary --> ALB (health check: monitors /health)
  Secondary --> S3 Static Site ("Under Maintenance" page)

  Health Check Configuration:
  - Type: HTTPS
  - Path: /health
  - Interval: 10 seconds
  - Failure Threshold: 3
  - EvaluateTargetHealth: true (also monitors behind the ALB)
```

### Anti-Pattern 3: Using CNAME at Zone Apex

```
[Bad Example]
  example.com --> CNAME --> d111111.cloudfront.net
  --> RFC violation: CNAME cannot be set at Zone Apex
  --> DNS errors will occur

[Good Example]
  example.com --> Alias --> d111111.cloudfront.net
  --> Can be used at Zone Apex
  --> Free DNS queries
  --> Automatically managed TTL
```

### Anti-Pattern 4: Not Setting a Default for Geolocation

```
[Bad Example]
  JP --> ap-northeast-1
  US --> us-east-1
  --> Users outside JP/US fail DNS resolution (NXDOMAIN)

[Good Example]
  JP --> ap-northeast-1
  US --> us-east-1
  * (Default) --> eu-west-1  <-- Always set a default
```

---

## 10. DNS Firewall

Route 53 Resolver DNS Firewall filters DNS queries from VPCs and blocks access to malicious domains.

```bash
# Create a DNS Firewall domain list
aws route53resolver create-firewall-domain-list \
  --name "blocked-domains" \
  --creator-request-id "blocked-$(date +%s)"

# Add domains
aws route53resolver update-firewall-domains \
  --firewall-domain-list-id rslvr-fdl-xxx \
  --operation ADD \
  --domains "*.malware.example.com" "phishing.example.com" "*.crypto-mining.example.com"

# Create a firewall rule group
aws route53resolver create-firewall-rule-group \
  --name "security-rules" \
  --creator-request-id "rules-$(date +%s)"

# Add a rule (block)
aws route53resolver create-firewall-rule \
  --firewall-rule-group-id rslvr-frg-xxx \
  --firewall-domain-list-id rslvr-fdl-xxx \
  --priority 100 \
  --action BLOCK \
  --block-response NXDOMAIN \
  --name "block-malware"

# Use AWS Managed domain lists (recommended)
# AmazonGuardDutyThreatList - Threat domains detected by GuardDuty
# AmazonRegisteredDomains - Domains registered with AWS

# Associate the rule group with a VPC
aws route53resolver associate-firewall-rule-group \
  --firewall-rule-group-id rslvr-frg-xxx \
  --vpc-id vpc-0abc1234 \
  --priority 101 \
  --name "protect-vpc"
```

### DNS Firewall Configuration with Terraform

```hcl
resource "aws_route53_resolver_firewall_domain_list" "blocked" {
  name    = "blocked-domains"
  domains = ["*.malware.example.com", "*.crypto-mining.example.com"]
}

resource "aws_route53_resolver_firewall_rule_group" "security" {
  name = "security-rules"
}

resource "aws_route53_resolver_firewall_rule" "block" {
  name                    = "block-malware"
  action                  = "BLOCK"
  block_response          = "NXDOMAIN"
  firewall_domain_list_id = aws_route53_resolver_firewall_domain_list.blocked.id
  firewall_rule_group_id  = aws_route53_resolver_firewall_rule_group.security.id
  priority                = 100
}

resource "aws_route53_resolver_firewall_rule_group_association" "main" {
  name                   = "protect-vpc"
  firewall_rule_group_id = aws_route53_resolver_firewall_rule_group.security.id
  vpc_id                 = aws_vpc.main.id
  priority               = 101
}
```


---

## Hands-On Exercises

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

# Test
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "An exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

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

# Test
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be mindful of algorithm time complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Configuration file issues | Verify configuration file path and format |
| Timeout | Network latency/resource shortage | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access permissions | Verify execution user permissions, review settings |
| Data inconsistency | Concurrent processing conflicts | Introduce locking mechanisms, transaction management |

### Debugging Procedure

1. **Check error messages**: Read stack traces and identify the location of occurrence
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Formulate hypotheses**: List possible causes
4. **Incremental verification**: Verify hypotheses using log output and debuggers
5. **Fix and regression test**: After fixing, also run tests on related areas

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
            logger.error(f"Exception occurred: {func.__name__}: {e}")
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

1. **Identify bottlenecks**: Measure with profiling tools
2. **Check memory usage**: Check for memory leaks
3. **Check I/O waits**: Review disk and network I/O status
4. **Check concurrent connections**: Review connection pool state

| Problem Type | Diagnostic Tool | Solution |
|-------------|-----------------|----------|
| CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Proper release of references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria | When Prioritized | When Acceptable to Compromise |
|----------|-----------------|-------------------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal information, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Architecture Pattern Selection

```
+------------------------------------------------+
|         Architecture Selection Flow             |
+------------------------------------------------+
|                                                 |
|  1. Team size?                                  |
|    +-- Small (1-5) --> Monolith                 |
|    +-- Large (10+) --> Go to 2.                 |
|                                                 |
|  2. Deployment frequency?                       |
|    +-- Weekly or less --> Monolith + modules    |
|    +-- Daily/multiple times --> Go to 3.        |
|                                                 |
|  3. Independence between teams?                 |
|    +-- High --> Microservices                   |
|    +-- Medium --> Modular monolith              |
|                                                 |
+------------------------------------------------+
```

### Trade-off Analysis

Technical decisions always involve trade-offs. Analyze from the following perspectives:

**1. Short-term vs Long-term Cost**
- Methods that are fast short-term can become technical debt long-term
- Conversely, over-engineering has high short-term costs and can cause project delays

**2. Consistency vs Flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies enables best-fit solutions but increases operational costs

**3. Level of Abstraction**
- High abstraction has high reusability but can make debugging more difficult
- Low abstraction is intuitive but tends to lead to code duplication

```python
# Design decision recording template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe the background and challenge"""
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
            icon = "+" if c['type'] == 'positive' else "!"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---

## 11. FAQ

### Q1: Can I purchase a domain with Route 53?

**A:** Yes, Route 53 also functions as a domain registrar. It supports many TLDs including `.com`, `.jp`, `.io`, and more. A hosted zone is automatically created for purchased domains. Annual registration fees vary by domain (.com is approximately $13/year). However, some domains like .co.jp cannot be purchased through Route 53, so the common approach is to purchase from an external registrar and point the NS records to Route 53.

### Q2: When should I use CNAME vs Alias?

**A:** Always use Alias for references to AWS resources (ALB, CloudFront, S3, etc.). Alias can be set at Zone Apex (example.com) and DNS queries are free. CNAME cannot be set at Zone Apex and queries are charged. Use CNAME for pointing to external services (Heroku, Vercel, etc.).

### Q3: How should I design DNS for multi-region?

**A:** Combine latency routing + health checks + failover. First, use latency routing to direct traffic to the nearest region, then failover when health checks detect anomalies. The best practice is to manage this configuration declaratively with Terraform's `aws_route53_record` and use IaC to uniformly manage all regions.

### Q4: How long does it take for DNS changes to propagate in Route 53?

**A:** Changes to Route 53 itself typically propagate to all edge locations worldwide within 60 seconds. However, for changes to existing records, the cache remains until the previous TTL expires. Therefore, the best practice for DNS migration is to set the TTL to a short value (around 60 seconds) in advance, then restore the TTL after the change.

### Q5: How do I obtain query logs from Route 53?

**A:** Use Route 53 Query Logging. You can send query logs to CloudWatch Logs, recording the queried domain name, record type, response code, source IP, and more. This is useful for security audits and troubleshooting.

```bash
# Enable query logging
aws route53resolver create-resolver-query-log-config \
  --name "dns-query-log" \
  --destination-arn "arn:aws:logs:ap-northeast-1:123456789012:log-group:/route53/query-log"

# Associate with a VPC
aws route53resolver associate-resolver-query-log-config \
  --resolver-query-log-config-id rqlc-xxx \
  --resource-id vpc-0abc1234
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not only through theory but also by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge used in practice?

Knowledge of this topic is frequently used in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| Hosted Zones | Use public (internet) and private (within VPC) appropriately |
| Record Types | Prefer Alias for AWS resources. Also supports Zone Apex |
| Routing | Select policies based on use case. Failover is essential for production |
| Health Checks | Combine endpoint monitoring + EvaluateTargetHealth |
| TTL | Normally 300 seconds. Shorten before migration, restore after completion |
| Cost | Alias queries are free. Health checks cost a few hundred yen/month |
| DNSSEC | Zone signing to verify authenticity of DNS responses |
| Resolver | DNS resolution in hybrid environments (Inbound/Outbound) |
| Security | Protect with CAA records + DNSSEC + query logging |

---

## Recommended Next Reads

- [02-api-gateway.md](./02-api-gateway.md) -- API Gateway that integrates with Route 53
- [00-vpc-basics.md](./00-vpc-basics.md) -- VPC, the foundation for private hosted zones
- [02-waf-shield.md](../08-security/02-waf-shield.md) -- DDoS protection with Route 53 + Shield

---

## References

1. **AWS Official Documentation** -- Amazon Route 53 Developer Guide
   https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/
2. **AWS Route 53 Routing Policies** -- Details and configuration for each policy
   https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html
3. **AWS Well-Architected -- Reliability Pillar** -- DNS and failover design
   https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/
4. **AWS Route 53 Resolver** -- Hybrid DNS design guide
   https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html
5. **DNSSEC Signing** -- Configuring DNSSEC in Route 53
   https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-configuring-dnssec.html
