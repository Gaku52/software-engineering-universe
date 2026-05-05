# EC2 Advanced

> Operate EC2 at a production level using Auto Scaling, load balancers, Spot Instances, and Savings Plans

## What You Will Learn

1. Design Auto Scaling groups and implement scaling policies that respond to load
2. Understand the characteristics of ALB / NLB and select and configure the appropriate load balancer
3. Optimize costs by leveraging Spot Instances and Savings Plans
4. Manage Auto Scaling + ALB infrastructure as code with CloudFormation / CDK
5. Achieve a high cost-performance configuration by combining Graviton and Spot with mixed instances policies


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts
- Familiarity with the content of [EC2 Basics](./00-ec2-basics.md)

---

## 1. Auto Scaling

### 1.1 Components of Auto Scaling

```
Auto Scaling Architecture
+----------------------------------------------------------+
|                                                           |
|  +-------------------+     +--------------------------+  |
|  | Launch Template    |     | Auto Scaling Group        |  |
|  | - AMI             | --> | - Min: 2                   |  |
|  | - Instance Type   |     | - Desired: 2               |  |
|  | - Security Grp    |     | - Max: 10                  |  |
|  | - User Data       |     | - AZ: 1a, 1c, 1d          |  |
|  +-------------------+     +--------------------------+  |
|                                    |                      |
|                                    v                      |
|  +---------------------------------------------------+   |
|  | Scaling Policies                                   |  |
|  | - Target Tracking: Maintain CPU at 60%             |  |
|  | - Step: CPU 80%→+2 instances, 90%→+4 instances    |  |
|  | - Scheduled: 5 instances at 9 AM on weekdays       |  |
|  | - Predictive: ML-based demand forecasting          |  |
|  +---------------------------------------------------+   |
|                                                           |
|  +---------------------------------------------------+   |
|  | Lifecycle Hooks                                    |  |
|  | - On launch: Wait until configuration completes    |  |
|  | - On termination: Evacuate logs, drain connections |  |
|  +---------------------------------------------------+   |
+----------------------------------------------------------+
```

### 1.2 Code Example: Creating a Launch Template

```bash
# Create a launch template
aws ec2 create-launch-template \
  --launch-template-name web-server-template \
  --version-description "v1.0 - NGINX + Node.js" \
  --launch-template-data '{
    "ImageId": "ami-0abcdef1234567890",
    "InstanceType": "t3.small",
    "KeyName": "my-key-pair",
    "SecurityGroupIds": ["sg-0123456789abcdef0"],
    "IamInstanceProfile": {
      "Name": "EC2-WebServer-Profile"
    },
    "BlockDeviceMappings": [
      {
        "DeviceName": "/dev/xvda",
        "Ebs": {
          "VolumeSize": 30,
          "VolumeType": "gp3",
          "Encrypted": true
        }
      }
    ],
    "MetadataOptions": {
      "HttpTokens": "required",
      "HttpEndpoint": "enabled"
    },
    "Monitoring": {
      "Enabled": true
    },
    "TagSpecifications": [
      {
        "ResourceType": "instance",
        "Tags": [
          {"Key": "Name", "Value": "web-server"},
          {"Key": "Environment", "Value": "production"}
        ]
      }
    ],
    "UserData": "'$(base64 -w 0 startup.sh)'"
  }'

# Create a new version of the launch template
aws ec2 create-launch-template-version \
  --launch-template-name web-server-template \
  --version-description "v2.0 - Graviton migration" \
  --source-version 1 \
  --launch-template-data '{
    "ImageId": "ami-0fedcba9876543210",
    "InstanceType": "t4g.small"
  }'

# Set default version
aws ec2 modify-launch-template \
  --launch-template-name web-server-template \
  --default-version 2

# List launch template versions
aws ec2 describe-launch-template-versions \
  --launch-template-name web-server-template \
  --query 'LaunchTemplateVersions[].[VersionNumber,VersionDescription,LaunchTemplateData.InstanceType]' \
  --output table
```

### 1.3 Code Example: Creating an Auto Scaling Group

```bash
# Create an Auto Scaling group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name web-asg \
  --launch-template LaunchTemplateName=web-server-template,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --vpc-zone-identifier "subnet-aaa,subnet-bbb,subnet-ccc" \
  --target-group-arns "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/web-tg/xxx" \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --default-cooldown 300 \
  --termination-policies '["OldestLaunchTemplate", "OldestInstance"]' \
  --new-instances-protected-from-scale-in \
  --capacity-rebalance \
  --tags '[
    {"Key": "Name", "Value": "web-server", "PropagateAtLaunch": true},
    {"Key": "Environment", "Value": "production", "PropagateAtLaunch": true}
  ]'

# Check ASG status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names web-asg \
  --query 'AutoScalingGroups[0].{Min:MinSize,Max:MaxSize,Desired:DesiredCapacity,Instances:Instances[*].{Id:InstanceId,AZ:AvailabilityZone,Health:HealthStatus,State:LifecycleState}}' \
  --output json
```

### 1.4 Mixed Instances Policy (Graviton + Spot)

As the definitive cost optimization approach, there is a configuration that combines Graviton instances with Spot Instances.

```bash
# Create an ASG with a mixed instances policy
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name web-asg-mixed \
  --mixed-instances-policy '{
    "LaunchTemplate": {
      "LaunchTemplateSpecification": {
        "LaunchTemplateName": "web-server-template",
        "Version": "$Latest"
      },
      "Overrides": [
        {"InstanceType": "t4g.small", "WeightedCapacity": "1"},
        {"InstanceType": "t4g.medium", "WeightedCapacity": "2"},
        {"InstanceType": "t3.small", "WeightedCapacity": "1"},
        {"InstanceType": "t3.medium", "WeightedCapacity": "2"},
        {"InstanceType": "m6g.large", "WeightedCapacity": "4"},
        {"InstanceType": "m5.large", "WeightedCapacity": "4"}
      ]
    },
    "InstancesDistribution": {
      "OnDemandBaseCapacity": 2,
      "OnDemandPercentageAboveBaseCapacity": 25,
      "SpotAllocationStrategy": "capacity-optimized",
      "SpotMaxPrice": ""
    }
  }' \
  --min-size 2 \
  --max-size 20 \
  --desired-capacity 4 \
  --vpc-zone-identifier "subnet-aaa,subnet-bbb,subnet-ccc" \
  --target-group-arns "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:targetgroup/web-tg/xxx" \
  --health-check-type ELB \
  --health-check-grace-period 300

# Result:
# - Base 2 instances are On-Demand (ensuring stability)
# - 75% of additional capacity is Spot (cost reduction)
# - 25% of additional capacity is On-Demand (ensuring availability)
# - capacity-optimized automatically selects pools with lower interruption risk
```

### 1.5 Types of Scaling Policies

| Policy | Mechanism | Use Case | Configuration Complexity |
|--------|-----------|----------|------------------------|
| Target Tracking | Maintains a metric at a target value | Maintain CPU utilization at 60% | Low |
| Step Scaling | Scales in stages based on threshold breach amount | Sudden load fluctuations | Medium |
| Simple Scaling | Adds/removes a fixed number at a single threshold | Simple rules | Low |
| Scheduled | Changes capacity at specified times | Business hours load patterns | Low |
| Predictive Scaling | Pre-scales based on ML demand forecasting | Cyclical traffic | Low |

### 1.6 Code Example: Target Tracking Policy

```bash
# Policy to maintain CPU utilization at 60%
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name web-asg \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 60.0,
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60,
    "DisableScaleIn": false
  }'

# Request count-based policy
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name web-asg \
  --policy-name request-count-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "app/my-alb/xxx/targetgroup/web-tg/yyy"
    },
    "TargetValue": 1000.0
  }'

# Custom metric-based policy (SQS queue length)
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name worker-asg \
  --policy-name sqs-queue-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "CustomizedMetricSpecification": {
      "MetricName": "ApproximateNumberOfMessagesVisible",
      "Namespace": "AWS/SQS",
      "Dimensions": [
        {"Name": "QueueName", "Value": "my-worker-queue"}
      ],
      "Statistic": "Average"
    },
    "TargetValue": 10.0
  }'
```

### 1.7 Code Example: Step Scaling Policy

```bash
# Scale out: Add instances in stages based on CPU
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name web-asg \
  --policy-name cpu-step-scale-out \
  --policy-type StepScaling \
  --adjustment-type ChangeInCapacity \
  --step-adjustments '[
    {"MetricIntervalLowerBound": 0, "MetricIntervalUpperBound": 20, "ScalingAdjustment": 1},
    {"MetricIntervalLowerBound": 20, "MetricIntervalUpperBound": 40, "ScalingAdjustment": 2},
    {"MetricIntervalLowerBound": 40, "ScalingAdjustment": 4}
  ]' \
  --metric-aggregation-type Average

# Corresponding CloudWatch alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "web-asg-cpu-high" \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=web-asg \
  --statistic Average \
  --period 60 \
  --evaluation-periods 2 \
  --threshold 60 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:autoscaling:ap-northeast-1:123456789012:scalingPolicy:xxx:autoScalingGroupName/web-asg:policyName/cpu-step-scale-out"
```

### 1.8 Code Example: Scheduled Scaling

```bash
# Scale out at 9:00 AM (JST) on weekdays
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name web-asg \
  --scheduled-action-name weekday-scale-out \
  --recurrence "0 0 * * MON-FRI" \
  --min-size 4 \
  --max-size 10 \
  --desired-capacity 4 \
  --time-zone "Asia/Tokyo"

# Scale in at 10:00 PM (JST) on weekdays
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name web-asg \
  --scheduled-action-name weekday-scale-in \
  --recurrence "0 13 * * MON-FRI" \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --time-zone "Asia/Tokyo"

# Minimum configuration on weekends
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name web-asg \
  --scheduled-action-name weekend-scale-down \
  --recurrence "0 0 * * SAT" \
  --min-size 2 \
  --max-size 4 \
  --desired-capacity 2 \
  --time-zone "Asia/Tokyo"

# Check schedule list
aws autoscaling describe-scheduled-actions \
  --auto-scaling-group-name web-asg \
  --output table
```

### 1.9 Predictive Scaling

```bash
# Enable predictive scaling
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name web-asg \
  --policy-name predictive-scaling \
  --policy-type PredictiveScaling \
  --predictive-scaling-configuration '{
    "MetricSpecifications": [{
      "TargetValue": 60.0,
      "PredefinedMetricPairSpecification": {
        "PredefinedMetricType": "ASGCPUUtilization"
      }
    }],
    "Mode": "ForecastAndScale",
    "SchedulingBufferTime": 300,
    "MaxCapacityBreachBehavior": "HonorMaxCapacity"
  }'

# Check prediction results
aws autoscaling get-predictive-scaling-forecast \
  --auto-scaling-group-name web-asg \
  --policy-name predictive-scaling \
  --start-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u -v+2d +%Y-%m-%dT%H:%M:%SZ)"
```

### 1.10 Lifecycle Hooks

```bash
# Lifecycle hook on launch (wait until configuration completes)
aws autoscaling put-lifecycle-hook \
  --auto-scaling-group-name web-asg \
  --lifecycle-hook-name launch-hook \
  --lifecycle-transition autoscaling:EC2_INSTANCE_LAUNCHING \
  --heartbeat-timeout 300 \
  --default-result CONTINUE \
  --notification-target-arn arn:aws:sns:ap-northeast-1:123456789012:asg-lifecycle

# Lifecycle hook on termination (log evacuation, connection draining)
aws autoscaling put-lifecycle-hook \
  --auto-scaling-group-name web-asg \
  --lifecycle-hook-name terminate-hook \
  --lifecycle-transition autoscaling:EC2_INSTANCE_TERMINATING \
  --heartbeat-timeout 600 \
  --default-result CONTINUE \
  --notification-target-arn arn:aws:sns:ap-northeast-1:123456789012:asg-lifecycle

# Lifecycle action completion notification
aws autoscaling complete-lifecycle-action \
  --auto-scaling-group-name web-asg \
  --lifecycle-hook-name launch-hook \
  --instance-id i-0123456789abcdef0 \
  --lifecycle-action-result CONTINUE
```

---

## 2. Elastic Load Balancing

### 2.1 Types of Load Balancers

```
                       Client
                           |
              +------------+------------+
              |            |            |
         +----v----+  +---v----+  +---v----+
         |   ALB   |  |  NLB   |  |  GLB   |
         | (L7)    |  | (L4)   |  | (L3)   |
         +---------+  +--------+  +--------+
         HTTP/HTTPS   TCP/UDP/TLS  Appliance
         Path routing  Ultra-low    Transparent
         Host routing  latency      IDS/IPS
         WebSocket    Fixed IP
         gRPC         NLB→ALB chaining
```

### 2.2 ALB vs NLB Comparison

| Feature | ALB | NLB |
|---------|-----|-----|
| OSI Layer | L7 (HTTP/HTTPS) | L4 (TCP/UDP/TLS) |
| Routing | Path, host, header, query | Port-based |
| Latency | A few milliseconds | Ultra-low latency (hundreds of microseconds) |
| Fixed IP | Not available (DNS name) | Available (Elastic IP) |
| SSL Termination | Supported | Supported |
| WebSocket | Supported | Supported |
| gRPC | Supported | Supported via TCP |
| Health Checks | HTTP/HTTPS | TCP/HTTP/HTTPS |
| Sticky Sessions | Cookie-based | None (source IP hash) |
| Cross-Zone | Enabled by default | Disabled by default |
| Pricing | Slightly higher | Slightly lower |
| PrivateLink | Not available | Supported |
| WAF Integration | Supported | Not available |

### 2.3 Code Example: Creating an ALB

```bash
# Create an ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name web-alb \
  --subnets subnet-aaa subnet-bbb subnet-ccc \
  --security-groups sg-alb-xxx \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --tags Key=Environment,Value=production \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Output ALB access logs to S3
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn $ALB_ARN \
  --attributes '[
    {"Key": "access_logs.s3.enabled", "Value": "true"},
    {"Key": "access_logs.s3.bucket", "Value": "my-alb-logs-bucket"},
    {"Key": "access_logs.s3.prefix", "Value": "web-alb"},
    {"Key": "idle_timeout.timeout_seconds", "Value": "60"},
    {"Key": "routing.http.drop_invalid_header_fields.enabled", "Value": "true"},
    {"Key": "routing.http2.enabled", "Value": "true"}
  ]'

# Create a target group
TG_ARN=$(aws elbv2 create-target-group \
  --name web-tg \
  --protocol HTTP --port 80 \
  --vpc-id vpc-xxx \
  --target-type instance \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --matcher '{"HttpCode": "200-299"}' \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Configure target group attributes
aws elbv2 modify-target-group-attributes \
  --target-group-arn $TG_ARN \
  --attributes '[
    {"Key": "deregistration_delay.timeout_seconds", "Value": "30"},
    {"Key": "slow_start.duration_seconds", "Value": "60"},
    {"Key": "stickiness.enabled", "Value": "true"},
    {"Key": "stickiness.type", "Value": "lb_cookie"},
    {"Key": "stickiness.lb_cookie.duration_seconds", "Value": "3600"}
  ]'

# Create an HTTPS listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn=arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06

# HTTP to HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions '[{
    "Type": "redirect",
    "RedirectConfig": {
      "Protocol": "HTTPS",
      "Port": "443",
      "StatusCode": "HTTP_301"
    }
  }]'
```

### 2.4 ALB Path-Based Routing

```
                    ALB
                     |
        +------------+------------+-----------+
        |            |            |           |
   /api/*       /static/*     /ws/*      /* (default)
        |            |            |           |
   +----v----+  +---v----+  +---v----+  +---v----+
   | API TG  |  | S3     |  | WS TG  |  | Web TG |
   | (Fargate)|  | (fixed |  | (WS)   |  | (EC2)  |
   +---------+  | resp.) +  +--------+  +--------+
                +--------+
```

```bash
# Add path-based routing rules
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --conditions '[{
    "Field": "path-pattern",
    "Values": ["/api/*"]
  }]' \
  --actions '[{
    "Type": "forward",
    "TargetGroupArn": "'$API_TG_ARN'"
  }]' \
  --priority 10

# Host-based routing
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --conditions '[{
    "Field": "host-header",
    "Values": ["api.example.com"]
  }]' \
  --actions '[{
    "Type": "forward",
    "TargetGroupArn": "'$API_TG_ARN'"
  }]' \
  --priority 20

# Compound conditions (path + header)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --conditions '[
    {"Field": "path-pattern", "Values": ["/api/v2/*"]},
    {"Field": "http-header", "HttpHeaderConfig": {"HttpHeaderName": "X-Api-Version", "Values": ["2"]}}
  ]' \
  --actions '[{
    "Type": "forward",
    "TargetGroupArn": "'$API_V2_TG_ARN'"
  }]' \
  --priority 5

# Weighted target groups (canary release)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --conditions '[{"Field": "path-pattern", "Values": ["/feature/*"]}]' \
  --actions '[{
    "Type": "forward",
    "ForwardConfig": {
      "TargetGroups": [
        {"TargetGroupArn": "'$STABLE_TG_ARN'", "Weight": 90},
        {"TargetGroupArn": "'$CANARY_TG_ARN'", "Weight": 10}
      ],
      "TargetGroupStickinessConfig": {
        "Enabled": true,
        "DurationSeconds": 3600
      }
    }
  }]' \
  --priority 15
```

### 2.5 Code Example: Creating an NLB

```bash
# Create an NLB (with fixed IP)
NLB_ARN=$(aws elbv2 create-load-balancer \
  --name tcp-nlb \
  --type network \
  --subnets subnet-aaa subnet-bbb subnet-ccc \
  --scheme internet-facing \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# When assigning fixed Elastic IPs
NLB_ARN=$(aws elbv2 create-load-balancer \
  --name tcp-nlb-eip \
  --type network \
  --subnet-mappings '[
    {"SubnetId": "subnet-aaa", "AllocationId": "eipalloc-aaa"},
    {"SubnetId": "subnet-bbb", "AllocationId": "eipalloc-bbb"}
  ]' \
  --scheme internet-facing \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# TCP target group
NLB_TG_ARN=$(aws elbv2 create-target-group \
  --name tcp-tg \
  --protocol TCP --port 443 \
  --vpc-id vpc-xxx \
  --target-type instance \
  --health-check-protocol TCP \
  --health-check-interval-seconds 10 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 2 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# TLS listener (TLS termination at NLB)
aws elbv2 create-listener \
  --load-balancer-arn $NLB_ARN \
  --protocol TLS --port 443 \
  --certificates CertificateArn=arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx \
  --default-actions Type=forward,TargetGroupArn=$NLB_TG_ARN \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06
```

### 2.6 ALB + NLB Chaining Pattern

```
     Client
       |
  +----v----+
  |   NLB   |  <- For fixed IP / PrivateLink
  |  (L4)   |
  +----+----+
       |
  +----v----+
  |   ALB   |  <- L7 routing / WAF
  |  (L7)   |
  +----+----+
       |
  +----v----+
  | Target  |
  | Group   |
  +---------+
```

---

## 3. Spot Instances

### 3.1 Purchase Option Comparison

| Option | Discount | Commitment | Interruption Risk | Use Case |
|--------|----------|------------|-------------------|----------|
| On-Demand | 0% | None | None | Baseline |
| Reserved (1 year) | Up to 40% | 1 year | None | Steady-state workloads |
| Reserved (3 years) | Up to 60% | 3 years | None | Long-term usage |
| Savings Plans (Compute) | Up to 66% | 1-3 years | None | Flexible commitment |
| Savings Plans (EC2) | Up to 72% | 1-3 years | None | Fixed to specific family |
| Spot | Up to 90% | None | Yes (2-min notice) | Batch, fault-tolerant workloads |

### 3.2 Spot Instance Allocation Strategies

| Strategy | Description | Recommended Use Case |
|----------|-------------|---------------------|
| capacity-optimized | Allocates from the pool with the most available capacity | General workloads (recommended) |
| capacity-optimized-prioritized | Capacity optimization with priorities | When you want to prioritize specific types |
| lowest-price | Allocates from the lowest-price pool | Maximum cost priority |
| diversified | Distributes evenly across multiple pools | Large fleets |
| price-capacity-optimized | Balances price and capacity | Balancing cost and availability |

### 3.3 Code Example: Requesting Spot Instances

```bash
# Spot Instance request (recommended: use ASG mixed policy)
aws ec2 request-spot-instances \
  --instance-count 5 \
  --type "one-time" \
  --launch-specification '{
    "ImageId": "ami-0abcdef1234567890",
    "InstanceType": "c5.xlarge",
    "KeyName": "my-key-pair",
    "SecurityGroupIds": ["sg-xxx"],
    "SubnetId": "subnet-xxx",
    "IamInstanceProfile": {"Name": "BatchWorkerProfile"}
  }'

# Launch a Spot Fleet (multiple instance types)
aws ec2 request-spot-fleet \
  --spot-fleet-request-config '{
    "IamFleetRole": "arn:aws:iam::123456789012:role/aws-ec2-spot-fleet-role",
    "TargetCapacity": 10,
    "LaunchSpecifications": [
      {"InstanceType": "c5.xlarge", "ImageId": "ami-xxx", "SubnetId": "subnet-aaa", "WeightedCapacity": 1},
      {"InstanceType": "c5a.xlarge", "ImageId": "ami-xxx", "SubnetId": "subnet-bbb", "WeightedCapacity": 1},
      {"InstanceType": "c5d.xlarge", "ImageId": "ami-xxx", "SubnetId": "subnet-ccc", "WeightedCapacity": 1},
      {"InstanceType": "c6i.xlarge", "ImageId": "ami-xxx", "SubnetId": "subnet-aaa", "WeightedCapacity": 1},
      {"InstanceType": "c6g.xlarge", "ImageId": "ami-xxx-arm64", "SubnetId": "subnet-bbb", "WeightedCapacity": 1}
    ],
    "AllocationStrategy": "capacityOptimized",
    "TerminateInstancesWithExpiration": true,
    "Type": "maintain",
    "ReplaceUnhealthyInstances": true
  }'

# Check Spot price history
aws ec2 describe-spot-price-history \
  --instance-types c5.xlarge c5a.xlarge c6i.xlarge \
  --product-descriptions "Linux/UNIX" \
  --start-time "$(date -u -v-1d +%Y-%m-%dT%H:%M:%SZ)" \
  --query 'SpotPriceHistory[].[InstanceType,AvailabilityZone,SpotPrice,Timestamp]' \
  --output table
```

### 3.4 Spot Interruption Handling

```
Spot Interruption Handling Flow

  EC2 Metadata            EventBridge            ASG
  (2-min notice)          (Interruption event)   (Auto replacement)
       |                       |                    |
       v                       v                    v
  +----------+          +-----------+         +-----------+
  | Check-   |          | Lambda    |         | New       |
  | point    |          | SQS re-   |         | instance  |
  | in-      |          | queue     |         | auto      |
  | progress |          | Slack     |         | launched  |
  | jobs     |          | notify    |         |           |
  +----------+          +-----------+         +-----------+
```

```bash
# Script to check Spot interruption notice via EC2 metadata
#!/bin/bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

while true; do
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/spot/instance-action)

  if [ "$RESPONSE" == "200" ]; then
    ACTION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
      http://169.254.169.254/latest/meta-data/spot/instance-action)
    echo "Spot interruption notice received: $ACTION"

    # Graceful shutdown process
    # 1. Stop accepting new requests
    /usr/local/bin/stop-accepting-requests.sh
    # 2. Checkpoint in-progress jobs
    /usr/local/bin/checkpoint-jobs.sh
    # 3. Flush logs to S3
    /usr/local/bin/flush-logs-to-s3.sh
    # 4. Deregister from load balancer
    /usr/local/bin/deregister-from-lb.sh
    break
  fi
  sleep 5
done
```

```bash
# Lambda to catch Spot interruptions via EventBridge
# EventBridge rule
aws events put-rule \
  --name "spot-interruption-handler" \
  --event-pattern '{
    "source": ["aws.ec2"],
    "detail-type": ["EC2 Spot Instance Interruption Warning"]
  }'

# Lambda target configuration
aws events put-targets \
  --rule "spot-interruption-handler" \
  --targets '[{
    "Id": "SpotInterruptionHandler",
    "Arn": "arn:aws:lambda:ap-northeast-1:123456789012:function:handle-spot-interruption"
  }]'
```

### 3.5 Spot Instance Best Practices

1. **Multiple instance types**: Specify at least 6 or more instance types
2. **Multiple AZs**: Use all available AZs
3. **capacity-optimized**: Automatically selects pools with lower interruption risk
4. **x86 + ARM mixed**: Expand the pool by including Graviton
5. **Checkpointing**: Periodically save state for long-running jobs
6. **ASG integration**: ASG mixed policy is recommended over standalone Spot Fleet

---

## 4. Savings Plans

### 4.1 Types of Savings Plans

```
  +-----------------------------------------------+
  | Compute Savings Plans                          |
  | - Applies to EC2, Fargate, Lambda              |
  | - Free to change region, family, OS            |
  | - Discount: Up to 66%                          |
  | - The most flexible option                     |
  +-----------------------------------------------+
  | EC2 Instance Savings Plans                     |
  | - Limited to specific region and family        |
  | - Instance size and OS can be changed          |
  | - Discount: Up to 72%                          |
  | - When higher discounts are needed             |
  +-----------------------------------------------+
  | SageMaker Savings Plans                        |
  | - Applies to SageMaker instances               |
  | - Discount: Up to 64%                          |
  +-----------------------------------------------+
```

### 4.2 Payment Option Comparison

| Payment Method | Discount | Cash Flow |
|---------------|----------|-----------|
| All Upfront | Maximum | One-time upfront payment |
| Partial Upfront | Medium | Half upfront + monthly |
| No Upfront | Minimum | Monthly only |

### 4.3 Code Example: Retrieving Savings Plans Information

```bash
# Check recommended Savings Plans
aws savingsplans describe-savings-plans-offerings \
  --service-codes AmazonEC2 \
  --payment-options NoUpfront \
  --plan-types ComputeSavingsPlans \
  --region us-east-1

# List current Savings Plans
aws savingsplans describe-savings-plans \
  --query 'savingsPlans[].[savingsPlanId,savingsPlanType,commitment,state,start,end]' \
  --output table

# Check Savings Plans utilization
aws ce get-savings-plans-utilization \
  --time-period Start=2026-01-01,End=2026-02-01 \
  --query 'Total.{Utilization:Utilization.UtilizationPercentage,TotalCommitment:AmortizedCommitment.TotalAmortizedCommitment,TotalSavings:SavingsPlansSavings}'

# Get Savings Plans recommendations from Cost Explorer
aws ce get-savings-plans-purchase-recommendation \
  --savings-plans-type COMPUTE_SP \
  --payment-option NO_UPFRONT \
  --term-in-years ONE_YEAR \
  --lookback-period-in-days THIRTY_DAYS
```

---

## 5. Cost Optimization Strategies

```
EC2 Cost Optimization Pyramid

         /\
        /  \  Spot (interruption tolerant)
       /    \    Up to 90% discount
      /------\
     /        \  Savings Plans / RI
    /          \    40-72% discount
   /------------\
  /              \  Right-sizing + Graviton
 /                \   20-40% reduction
/------------------\
  On-Demand (baseline)
```

| Strategy | Impact | Implementation Difficulty | Priority |
|----------|--------|--------------------------|----------|
| Remove unused resources | Immediate effect | Low | Highest |
| Right-sizing | 20-30% reduction | Medium | High |
| gp2 to gp3 migration | 20% reduction (EBS) | Low | High |
| Graviton migration | 20-40% reduction | Medium | High |
| Savings Plans | 40-72% reduction | Low | High |
| Spot utilization | Up to 90% reduction | Medium-High | Medium |
| Stopping dev environments | 50-70% reduction | Low | High |

### 5.1 Cost Optimization Implementation Examples

```bash
# Detect and delete unused Elastic IPs
aws ec2 describe-addresses \
  --query 'Addresses[?AssociationId==null].[AllocationId,PublicIp]' \
  --output table

# Detect underutilized instances (CPU utilization 5% or below)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0123456789abcdef0 \
  --start-time "$(date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 86400 \
  --statistics Average

# Detect unattached EBS volumes
aws ec2 describe-volumes \
  --filters "Name=status,Values=available" \
  --query 'Volumes[].[VolumeId,Size,VolumeType,CreateTime]' \
  --output table

# Detect old snapshots (older than 90 days)
aws ec2 describe-snapshots --owner-ids self \
  --query "Snapshots[?StartTime<='$(date -u -v-90d +%Y-%m-%dT%H:%M:%SZ)'].[SnapshotId,VolumeSize,StartTime,Description]" \
  --output table

# Get AWS Compute Optimizer recommendations
aws compute-optimizer get-ec2-instance-recommendations \
  --query 'instanceRecommendations[].{Instance:instanceArn,Current:currentInstanceType,Recommended:recommendationOptions[0].instanceType,Finding:finding,Savings:recommendationOptions[0].estimatedMonthlySavings.value}' \
  --output table
```

### 5.2 Automatic Stop/Start of Development Environments

```bash
# Stop dev environments at night using EventBridge + Lambda
# Lambda function example (Python)
# Stop targets: Instances with Environment=development tag

# Stop schedule (daily at 8:00 PM JST)
aws events put-rule \
  --name stop-dev-instances \
  --schedule-expression "cron(0 11 * * ? *)" \
  --state ENABLED

# Start schedule (daily at 9:00 AM JST)
aws events put-rule \
  --name start-dev-instances \
  --schedule-expression "cron(0 0 ? * MON-FRI *)" \
  --state ENABLED
```

---

## 6. CloudFormation Template (ALB + ASG)

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Production-grade ALB + Auto Scaling Group

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
  PublicSubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  PrivateSubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  CertificateArn:
    Type: String
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64

Resources:
  # ALB Security Group
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ALB Security Group
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0

  # EC2 Security Group
  EC2SecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: EC2 Security Group
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  # ALB
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: web-alb
      Type: application
      Scheme: internet-facing
      Subnets: !Ref PublicSubnetIds
      SecurityGroups:
        - !Ref ALBSecurityGroup
      LoadBalancerAttributes:
        - Key: idle_timeout.timeout_seconds
          Value: '60'
        - Key: routing.http.drop_invalid_header_fields.enabled
          Value: 'true'

  # Target Group
  TargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: web-tg
      Protocol: HTTP
      Port: 80
      VpcId: !Ref VpcId
      TargetType: instance
      HealthCheckPath: /health
      HealthCheckIntervalSeconds: 30
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3
      TargetGroupAttributes:
        - Key: deregistration_delay.timeout_seconds
          Value: '30'

  # HTTPS Listener
  HTTPSListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Protocol: HTTPS
      Port: 443
      Certificates:
        - CertificateArn: !Ref CertificateArn
      SslPolicy: ELBSecurityPolicy-TLS13-1-2-2021-06
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref TargetGroup

  # HTTP to HTTPS Redirect
  HTTPListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Protocol: HTTP
      Port: 80
      DefaultActions:
        - Type: redirect
          RedirectConfig:
            Protocol: HTTPS
            Port: '443'
            StatusCode: HTTP_301

  # Launch Template
  LaunchTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateName: web-server-lt
      LaunchTemplateData:
        ImageId: !Ref LatestAmiId
        InstanceType: t3.small
        SecurityGroupIds:
          - !Ref EC2SecurityGroup
        MetadataOptions:
          HttpTokens: required
          HttpEndpoint: enabled
        Monitoring:
          Enabled: true
        BlockDeviceMappings:
          - DeviceName: /dev/xvda
            Ebs:
              VolumeSize: 30
              VolumeType: gp3
              Encrypted: true

  # Auto Scaling Group
  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      AutoScalingGroupName: web-asg
      LaunchTemplate:
        LaunchTemplateId: !Ref LaunchTemplate
        Version: !GetAtt LaunchTemplate.LatestVersionNumber
      MinSize: 2
      MaxSize: 10
      DesiredCapacity: 2
      VPCZoneIdentifier: !Ref PrivateSubnetIds
      TargetGroupARNs:
        - !Ref TargetGroup
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300
      Tags:
        - Key: Name
          Value: web-server
          PropagateAtLaunch: true

  # Scaling Policy
  CPUScalingPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AutoScalingGroupName: !Ref AutoScalingGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ASGAverageCPUUtilization
        TargetValue: 60
        ScaleInCooldown: 300
        ScaleOutCooldown: 60

Outputs:
  ALBDNSName:
    Value: !GetAtt ApplicationLoadBalancer.DNSName
  ALBHostedZoneId:
    Value: !GetAtt ApplicationLoadBalancer.CanonicalHostedZoneID
```

---

## 7. Anti-Patterns

### Anti-Pattern 1: Placing All Instances in a Single AZ

```
# Bad example - Only 1 AZ
Auto Scaling Group -> subnet-1a only
-> Total outage if the AZ fails

# Good example - Distributed across multiple AZs
Auto Scaling Group -> subnet-1a, subnet-1c, subnet-1d
-> If one AZ fails, the rest continue operating
```

### Anti-Pattern 2: Setting the Auto Scaling Minimum to 0

With a minimum of 0, all instances may be terminated during scale-in. In production environments, you should ensure a minimum of 2 (multi-AZ).

```bash
# Bad example
--min-size 0 --desired-capacity 1

# Good example (production)
--min-size 2 --desired-capacity 2 --max-size 10
```

### Anti-Pattern 3: Scaling Without Health Checks

EC2 status checks alone cannot detect application-level failures. You should combine ELB health checks with custom health checks.

```bash
# Bad example - EC2 status checks only
--health-check-type EC2

# Good example - ELB health check (HTTP level)
--health-check-type ELB --health-check-grace-period 300
```

### Anti-Pattern 4: Using Spot Instances with a Single Type

```bash
# Bad example - Only one instance type
"LaunchSpecifications": [
  {"InstanceType": "c5.xlarge", ...}
]
# -> All may be interrupted due to capacity shortage in that pool

# Good example - Multiple types and multiple AZs
"Overrides": [
  {"InstanceType": "c5.xlarge"},
  {"InstanceType": "c5a.xlarge"},
  {"InstanceType": "c5d.xlarge"},
  {"InstanceType": "c6i.xlarge"},
  {"InstanceType": "c6g.xlarge"},
  {"InstanceType": "m5.xlarge"}
]
```

### Anti-Pattern 5: Not Setting a Health Check Grace Period During Deployment

```bash
# Bad example - No grace period
# -> Marked unhealthy before the application starts, causing an infinite loop
--health-check-grace-period 0

# Good example - Account for application startup time
# Wait 5 minutes for the app to finish starting
--health-check-grace-period 300
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that meets the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

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
        """Remove by key"""
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

    print(f"Inefficient version: {slow_time:.4f}s")
    print(f"Efficient version:   {fast_time:.6f}s")
    print(f"Speedup factor: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key Points:**
- Be aware of algorithm computational complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 8. FAQ

### Q1. Should I choose ALB or NLB?

Choose ALB for HTTP/HTTPS-based web applications. Choose NLB when you need TCP/UDP-level routing, ultra-low latency, or fixed IPs. ALB supports gRPC at the L7 level, but NLB can also pass it through as TCP. ALB is required if you want to use WAF. Use NLB when you need to expose services between VPCs via PrivateLink.

### Q2. How often do Spot Instance interruptions occur?

It depends on the region and instance type, but using the capacityOptimized strategy with multiple types significantly reduces interruption frequency. You can check interruption rates in advance with the AWS Spot Instance Advisor. Generally, using 6 or more instance types and 3 or more AZs can keep the interruption rate below 5%.

### Q3. What is the difference between Savings Plans and Reserved Instances?

Savings Plans are based on "committed amount/hour" and offer high flexibility, allowing changes to instance family, region, and OS (for Compute SP). RIs are tied to specific instance types and AZs. Savings Plans are recommended for new purchases. RIs should only be continued if already owned, and new purchases should use SPs.

### Q4. What should I do when Auto Scaling scale-out is slow?

1. **Predictive Scaling**: Pre-scale using ML-based forecasting
2. **Warm Pool**: Pre-prepare instances in stopped state
3. **Golden AMI**: Minimize setup time at launch
4. **Shorten scale-out cooldown period**: Set to around 60 seconds
5. **Step Scaling**: Handle sudden load spikes

```bash
# Warm pool configuration
aws autoscaling put-warm-pool \
  --auto-scaling-group-name web-asg \
  --pool-state Stopped \
  --min-size 2 \
  --max-group-prepared-capacity 5
```

### Q5. What if the load balancer health checks keep failing?

1. **Check the health check path**: Verify the application returns 200 at `/health`
2. **Check security groups**: Ensure the port from ALB to EC2 is open
3. **Check the grace period**: Ensure sufficient time is configured for app startup
4. **Health check interval and timeout**: Check if the timeout is too short
5. **Check application logs**: Look for errors

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What are common mistakes beginners make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this applied in real-world work?

Knowledge of this topic is frequently used in daily development work. It becomes especially important during code reviews and architecture design.

---

## 9. Summary

| Item | Key Points |
|------|-----------|
| Auto Scaling | Three-layer structure: Launch Template + ASG + Scaling Policies |
| Mixed Policy | Cost optimization by combining Graviton + Spot + On-Demand |
| ALB | L7 routing, path/host-based, HTTP/HTTPS, WAF integration |
| NLB | L4 routing, ultra-low latency, fixed IP, PrivateLink |
| Spot | Up to 90% discount, interruption handling required, capacityOptimized recommended, multiple types |
| Savings Plans | Flexible cost reduction with Compute SP, 1-year/3-year commitment |
| Cost Optimization | Execute in order: delete -> right-size -> Graviton -> SP/RI -> Spot |
| Lifecycle | Implement custom processing at launch/termination with hooks |
| IaC | Manage ALB + ASG together with CloudFormation / CDK |

---

## Recommended Next Reads

- [02-elastic-beanstalk.md](./02-elastic-beanstalk.md) -- Managed deployment with Elastic Beanstalk
- [../04-networking/00-vpc-basics.md](../04-networking/00-vpc-basics.md) -- VPC design

---

## References

1. Amazon EC2 Auto Scaling User Guide -- https://docs.aws.amazon.com/autoscaling/ec2/userguide/
2. Elastic Load Balancing User Guide -- https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/
3. Amazon EC2 Spot Instance Best Practices -- https://docs.aws.amazon.com/ec2/latest/userguide/spot-best-practices.html
4. Savings Plans User Guide -- https://docs.aws.amazon.com/savingsplans/latest/userguide/
5. Auto Scaling Mixed Instances Policy -- https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-mixed-instances-groups.html
6. ALB Listener Rules -- https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-update-rules.html
