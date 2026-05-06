# AWS CDK (Cloud Development Kit)

> A systematic guide to AWS CDK — defining AWS infrastructure with programming languages — covering core concepts, TypeScript/Python implementation, L1/L2/L3 constructs, testing, and CI/CD integration.

---

## What You Will Learn

1. **CDK Core Concepts and Project Structure** -- Understand the App/Stack/Construct hierarchy and the CDK project initialization and deployment workflow
2. **Choosing Between L1/L2/L3 Constructs** -- Select constructs at the appropriate abstraction level to define infrastructure efficiently
3. **Testing and CI/CD Integration** -- Practice snapshot testing, fine-grained assertions, and automated deployment via pipelines
4. **Multi-Stack Design and Cross-Stack References** -- Learn design patterns for large-scale infrastructure that coordinates multiple stacks
5. **Automated Deployment with CDK Pipelines** -- Understand the self-mutation pattern that manages CDK itself through a pipeline

## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [AWS CloudFormation](./00-cloudformation.md)

---

## 1. CDK Core Concepts

### 1.1 CDK Architecture

```
CDK Workflow:

TypeScript / Python code
    |
    | cdk synth
    v
+----------------------+
| CloudFormation       |
| Template (JSON)      |
+----------------------+
    |
    | cdk deploy
    v
+----------------------+
| CloudFormation       |
| Stack                |
+----------------------+
    |
    v
+----------------------+
| AWS Resources        |
| (VPC, Lambda, etc.)  |
+----------------------+

CDK Hierarchy:
+-----------------------------------+
| App                               |
|   +-----------------------------+ |
|   | Stack A (dev)               | |
|   |   +-----+ +-----+ +-----+ | |
|   |   | L2  | | L2  | | L3  | | |
|   |   | VPC | | Lambda| | API | | |
|   |   +-----+ +-----+ +-----+ | |
|   +-----------------------------+ |
|   +-----------------------------+ |
|   | Stack B (prod)              | |
|   |   +-----+ +-----+ +-----+ | |
|   |   | L2  | | L2  | | L3  | | |
|   |   +-----+ +-----+ +-----+ | |
|   +-----------------------------+ |
+-----------------------------------+
```

### 1.2 CDK vs CloudFormation vs Terraform

| Property | CDK | CloudFormation | Terraform |
|----------|-----|----------------|-----------|
| Language | TypeScript, Python, Java, Go, C# | YAML/JSON | HCL |
| Abstraction | L1/L2/L3 constructs | None | Modules |
| Loops/Conditions | Native language features | Limited | count, for_each |
| Testing | Unit-testable | cfn-lint | terraform plan |
| State Management | CloudFormation | CloudFormation | tfstate |
| Multi-Cloud | AWS only | AWS only | Multi-cloud |
| Learning Curve | Low for programmers | Moderate | Moderate |
| IDE Support | Type completion, refactoring | VSCode plugin | VSCode plugin |
| Drift Detection | Via CloudFormation | Native | Detected by plan |
| Ecosystem | Construct Hub | Registry | Registry |

### 1.3 Features of CDK v2

In CDK v2, all modules are consolidated into the single `aws-cdk-lib` package. The individual packages such as `@aws-cdk/aws-s3` and `@aws-cdk/aws-lambda` that were installed separately in v1 are no longer needed, greatly simplifying dependency management.

```typescript
// CDK v1 (legacy)
import * as s3 from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda';

// CDK v2 (current)
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
```

Key changes:
- **Single package**: All modules consolidated into `aws-cdk-lib`
- **Constructs library separated**: The `constructs` package is now independent
- **Stable APIs only**: Experimental APIs are separated into alpha packages under the `@aws-cdk` scope
- **Backward compatibility**: Backward compatibility is guaranteed between minor versions

---

## 2. CDK Project Structure

### 2.1 Project Initialization

```bash
# Install CDK CLI
npm install -g aws-cdk

# Check version
cdk --version

# Create a TypeScript project
mkdir my-cdk-app && cd my-cdk-app
cdk init app --language typescript

# Create a Python project
mkdir my-cdk-app && cd my-cdk-app
cdk init app --language python
source .venv/bin/activate
pip install -r requirements.txt

# Create a Java project
mkdir my-cdk-app && cd my-cdk-app
cdk init app --language java

# Create a Go project
mkdir my-cdk-app && cd my-cdk-app
cdk init app --language go
```

### 2.2 TypeScript Project Structure

```
my-cdk-app/
├── bin/
│   └── my-cdk-app.ts        # App entry point
├── lib/
│   ├── network-stack.ts      # Network stack
│   ├── app-stack.ts          # Application stack
│   ├── database-stack.ts     # Database stack
│   ├── monitoring-stack.ts   # Monitoring stack
│   └── constructs/           # Custom constructs
│       ├── api-construct.ts
│       └── vpc-construct.ts
├── test/
│   ├── network-stack.test.ts # Tests
│   ├── app-stack.test.ts
│   └── snapshot/             # Snapshots
├── lambda/                   # Lambda function source code
│   ├── handler.py
│   └── requirements.txt
├── cdk.json                  # CDK configuration
├── cdk.context.json          # Context value cache
├── package.json
└── tsconfig.json
```

### 2.3 App Entry Point

```typescript
// bin/my-cdk-app.ts
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';
import { AppStack } from '../lib/app-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};

// Get the environment name from context
const environmentName = app.node.tryGetContext('env') || 'dev';

// Define inter-stack dependencies
const networkStack = new NetworkStack(app, `${environmentName}-NetworkStack`, {
  env,
  environmentName,
});

const databaseStack = new DatabaseStack(app, `${environmentName}-DatabaseStack`, {
  env,
  vpc: networkStack.vpc,
  environmentName,
});

const appStack = new AppStack(app, `${environmentName}-AppStack`, {
  env,
  vpc: networkStack.vpc,
  table: databaseStack.table,
  environmentName,
});

new MonitoringStack(app, `${environmentName}-MonitoringStack`, {
  env,
  lambdaFunction: appStack.handler,
  apiGateway: appStack.api,
  environmentName,
});

// Apply tags to the entire app
cdk.Tags.of(app).add('Project', 'MyApp');
cdk.Tags.of(app).add('Environment', environmentName);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
```

### 2.4 cdk.json Configuration

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/my-cdk-app.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
    "@aws-cdk/core:stackRelativeExports": true,
    "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
    "@aws-cdk/aws-lambda:recognizeVersionProps": true,
    "@aws-cdk/aws-ec2:restrictDefaultSecurityGroup": true,
    "env": "dev",
    "vpcCidr": "10.0.0.0/16",
    "maxAzs": 3
  }
}
```

---

## 3. L1/L2/L3 Constructs

### 3.1 Construct Abstraction Levels

```
Construct Hierarchy:

L3 (Patterns): Combinations of multiple resources
  aws-ecs-patterns.ApplicationLoadBalancedFargateService
  → Creates ALB + ECS Service + Task Definition + CloudWatch all at once
       |
       v
L2 (High-level): High-level abstraction for individual resources
  aws-ec2.Vpc, aws-lambda.Function, aws-s3.Bucket
  → Default values, helper methods, type safety
       |
       v
L1 (CFn Resources): 1:1 mapping to CloudFormation resources
  aws-ec2.CfnVPC, aws-lambda.CfnFunction
  → Same granularity as CloudFormation templates
```

### 3.2 Defining a VPC with L2 Constructs

```typescript
// lib/network-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

interface NetworkStackProps extends cdk.StackProps {
  environmentName: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    // L2 construct: automatically creates NAT GW, IGW, and route tables by default
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 3,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      natGateways: props.environmentName === 'prod' ? 3 : 1,
      // Enable VPC Flow Logs
      flowLogs: {
        's3FlowLog': {
          destination: ec2.FlowLogDestination.toS3(),
          trafficType: ec2.FlowLogTrafficType.REJECT,
        },
      },
    });

    // Add VPC endpoints (access AWS services from private subnets)
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
    });

    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Tagging
    cdk.Tags.of(this.vpc).add('Environment', props.environmentName);

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      exportName: `${props.environmentName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      exportName: `${props.environmentName}-PrivateSubnetIds`,
    });
  }
}
```

### 3.3 Defining a Lambda Function with L2 Constructs

```typescript
// lib/app-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface AppStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  table: dynamodb.Table;
  environmentName: string;
}

export class AppStack extends cdk.Stack {
  public readonly handler: lambda.Function;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // Lambda layer (shared libraries)
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset('lambda/layers/common'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'Common utility library',
    });

    // Lambda function
    this.handler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.PYTHON_3_12,
      code: lambda.Code.fromAsset('lambda/'),
      handler: 'handler.lambda_handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        TABLE_NAME: props.table.tableName,
        ENVIRONMENT: props.environmentName,
        POWERTOOLS_SERVICE_NAME: 'my-api',
        LOG_LEVEL: props.environmentName === 'prod' ? 'INFO' : 'DEBUG',
      },
      tracing: lambda.Tracing.ACTIVE,
      layers: [commonLayer],
      logRetention: logs.RetentionDays.ONE_MONTH,
      // To run inside a VPC:
      // vpc: props.vpc,
      // vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Grant IAM permissions (CDK automatically generates least-privilege policies)
    props.table.grantReadWriteData(this.handler);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'ItemsApi', {
      restApiName: `items-api-${props.environmentName}`,
      description: 'Items CRUD API',
      deployOptions: {
        stageName: props.environmentName,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: props.environmentName !== 'prod',
        metricsEnabled: true,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 500,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const items = this.api.root.addResource('items');
    items.addMethod('GET', new apigateway.LambdaIntegration(this.handler));
    items.addMethod('POST', new apigateway.LambdaIntegration(this.handler));

    const item = items.addResource('{id}');
    item.addMethod('GET', new apigateway.LambdaIntegration(this.handler));
    item.addMethod('PUT', new apigateway.LambdaIntegration(this.handler));
    item.addMethod('DELETE', new apigateway.LambdaIntegration(this.handler));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
    });
  }
}
```

### 3.4 Example of L3 Constructs (Patterns)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';

// L3: Create an ALB + Fargate service in a single call
const cluster = new ecs.Cluster(this, 'Cluster', {
  vpc,
  containerInsights: true,
});

const certificate = certificatemanager.Certificate.fromCertificateArn(
  this, 'Cert',
  'arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx'
);

const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
  this, 'WebService', {
    cluster,
    taskImageOptions: {
      image: ecs.ContainerImage.fromAsset('./app'),
      containerPort: 8080,
      environment: {
        NODE_ENV: 'production',
      },
      logDriver: ecs.LogDrivers.awsLogs({
        streamPrefix: 'web-service',
      }),
    },
    cpu: 512,
    memoryLimitMiB: 1024,
    desiredCount: 3,
    publicLoadBalancer: true,
    certificate,
    redirectHTTP: true,
    circuitBreaker: { rollback: true },
    healthCheckGracePeriod: cdk.Duration.seconds(60),
  }
);

// Configure health check
service.targetGroup.configureHealthCheck({
  path: '/health',
  interval: cdk.Duration.seconds(30),
  timeout: cdk.Duration.seconds(5),
  healthyThresholdCount: 2,
  unhealthyThresholdCount: 3,
});

// Add Auto Scaling
const scaling = service.service.autoScaleTaskCount({
  minCapacity: 2,
  maxCapacity: 20,
});
scaling.scaleOnCpuUtilization('CpuScaling', {
  targetUtilizationPercent: 70,
  scaleInCooldown: cdk.Duration.seconds(60),
  scaleOutCooldown: cdk.Duration.seconds(60),
});
scaling.scaleOnMemoryUtilization('MemoryScaling', {
  targetUtilizationPercent: 80,
});
```

### 3.5 Creating a Custom L2 Construct

```typescript
// lib/constructs/secure-bucket.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SecureBucketProps {
  /**
   * Bucket name prefix. The account ID is automatically appended.
   */
  bucketNamePrefix: string;
  /**
   * Environment name (dev/staging/prod)
   */
  environmentName: string;
  /**
   * Lifecycle rule: transition to Glacier after this many days
   * @default 90
   */
  glacierTransitionDays?: number;
  /**
   * Lifecycle rule: delete after this many days
   * @default 365
   */
  expirationDays?: number;
  /**
   * Enable versioning
   * @default true
   */
  versioned?: boolean;
}

export class SecureBucket extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly encryptionKey: kms.Key;

  constructor(scope: Construct, id: string, props: SecureBucketProps) {
    super(scope, id);

    // Create KMS key
    this.encryptionKey = new kms.Key(this, 'Key', {
      alias: `${props.bucketNamePrefix}-${props.environmentName}`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      description: `Encryption key for ${props.bucketNamePrefix}`,
    });

    // Create a secure S3 bucket
    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${props.bucketNamePrefix}-${props.environmentName}-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.encryptionKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: props.versioned ?? true,
      removalPolicy: props.environmentName === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.environmentName !== 'prod',
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(props.glacierTransitionDays ?? 90),
            },
          ],
          expiration: cdk.Duration.days(props.expirationDays ?? 365),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      serverAccessLogsBucket: new s3.Bucket(this, 'AccessLogBucket', {
        bucketName: `${props.bucketNamePrefix}-access-logs-${cdk.Stack.of(this).account}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        lifecycleRules: [
          { expiration: cdk.Duration.days(90) },
        ],
      }),
    });

    // Bucket policy: allow HTTPS only
    this.bucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'DenyInsecureTransport',
      effect: iam.Effect.DENY,
      principals: [new iam.AnyPrincipal()],
      actions: ['s3:*'],
      resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
      conditions: {
        Bool: { 'aws:SecureTransport': 'false' },
      },
    }));
  }

  /**
   * Grant read access to the bucket for the specified role
   */
  grantRead(grantee: iam.IGrantable): iam.Grant {
    this.encryptionKey.grantDecrypt(grantee);
    return this.bucket.grantRead(grantee);
  }

  /**
   * Grant read/write access to the bucket for the specified role
   */
  grantReadWrite(grantee: iam.IGrantable): iam.Grant {
    this.encryptionKey.grantEncryptDecrypt(grantee);
    return this.bucket.grantReadWrite(grantee);
  }
}
```

---

## 4. CDK with Python

### 4.1 Python Stack Definition

```python
# lib/app_stack.py
from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_lambda as lambda_,
    aws_dynamodb as dynamodb,
    aws_apigateway as apigateway,
    aws_logs as logs,
    aws_iam as iam,
)
from constructs import Construct


class AppStack(Stack):
    def __init__(self, scope: Construct, id: str, environment_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # DynamoDB
        table = dynamodb.Table(
            self, "ItemsTable",
            partition_key=dynamodb.Attribute(
                name="id",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="created_at",
                type=dynamodb.AttributeType.STRING,
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
            point_in_time_recovery=True,
            stream=dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
        )

        # Add a GSI
        table.add_global_secondary_index(
            index_name="StatusIndex",
            partition_key=dynamodb.Attribute(
                name="status",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="updated_at",
                type=dynamodb.AttributeType.STRING,
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # Lambda
        handler = lambda_.Function(
            self, "ApiHandler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            code=lambda_.Code.from_asset("lambda/"),
            handler="handler.lambda_handler",
            timeout=Duration.seconds(30),
            memory_size=256,
            environment={
                "TABLE_NAME": table.table_name,
                "ENVIRONMENT": environment_name,
            },
            tracing=lambda_.Tracing.ACTIVE,
            log_retention=logs.RetentionDays.ONE_MONTH,
        )

        # Grant permissions
        table.grant_read_write_data(handler)

        # API Gateway
        api = apigateway.RestApi(
            self, "ItemsApi",
            rest_api_name=f"items-api-{environment_name}",
            deploy_options=apigateway.StageOptions(
                stage_name=environment_name,
                tracing_enabled=True,
                metrics_enabled=True,
            ),
        )

        items = api.root.add_resource("items")
        items.add_method("GET", apigateway.LambdaIntegration(handler))
        items.add_method("POST", apigateway.LambdaIntegration(handler))

        item = items.add_resource("{id}")
        item.add_method("GET", apigateway.LambdaIntegration(handler))
        item.add_method("PUT", apigateway.LambdaIntegration(handler))
        item.add_method("DELETE", apigateway.LambdaIntegration(handler))

        CfnOutput(self, "ApiUrl", value=api.url)
        CfnOutput(self, "TableName", value=table.table_name)
```

### 4.2 Custom Constructs in Python

```python
# lib/constructs/monitored_lambda.py
from aws_cdk import (
    Duration,
    aws_lambda as lambda_,
    aws_cloudwatch as cloudwatch,
    aws_cloudwatch_actions as cw_actions,
    aws_sns as sns,
    aws_logs as logs,
)
from constructs import Construct


class MonitoredLambda(Construct):
    """A construct that automatically attaches CloudWatch alarms and dashboards to a Lambda function"""

    def __init__(
        self,
        scope: Construct,
        id: str,
        *,
        function_name: str,
        handler: str,
        code: lambda_.Code,
        runtime: lambda_.Runtime = lambda_.Runtime.PYTHON_3_12,
        timeout: Duration = Duration.seconds(30),
        memory_size: int = 256,
        environment: dict = None,
        alarm_topic: sns.ITopic = None,
        error_rate_threshold: float = 5.0,
        duration_threshold_ms: float = 10000,
    ):
        super().__init__(scope, id)

        # Lambda function
        self.function = lambda_.Function(
            self, "Function",
            function_name=function_name,
            runtime=runtime,
            code=code,
            handler=handler,
            timeout=timeout,
            memory_size=memory_size,
            environment=environment or {},
            tracing=lambda_.Tracing.ACTIVE,
            log_retention=logs.RetentionDays.TWO_WEEKS,
        )

        # Error rate alarm
        errors = self.function.metric_errors(period=Duration.minutes(5))
        invocations = self.function.metric_invocations(period=Duration.minutes(5))

        error_rate = cloudwatch.MathExpression(
            expression="(errors / invocations) * 100",
            using_metrics={
                "errors": errors,
                "invocations": invocations,
            },
            label="Error Rate (%)",
            period=Duration.minutes(5),
        )

        self.error_alarm = cloudwatch.Alarm(
            self, "ErrorRateAlarm",
            metric=error_rate,
            threshold=error_rate_threshold,
            evaluation_periods=3,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            alarm_description=f"Error rate for {function_name} exceeded {error_rate_threshold}%",
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )

        # Latency alarm
        self.duration_alarm = cloudwatch.Alarm(
            self, "DurationAlarm",
            metric=self.function.metric_duration(
                statistic="p99",
                period=Duration.minutes(5),
            ),
            threshold=duration_threshold_ms,
            evaluation_periods=3,
            alarm_description=f"p99 latency for {function_name} exceeded {duration_threshold_ms}ms",
        )

        # SNS notifications
        if alarm_topic:
            self.error_alarm.add_alarm_action(cw_actions.SnsAction(alarm_topic))
            self.duration_alarm.add_alarm_action(cw_actions.SnsAction(alarm_topic))
```

---

## 5. Testing

### 5.1 Types of Tests

```
CDK Test Types:

+--------------------+     +--------------------+     +--------------------+
| Snapshot           |     | Fine-grained       |     | Validation         |
| Tests              |     | Assertions         |     | Tests              |
+--------------------+     +--------------------+     +--------------------+
| Compare the entire |     | Verify the         |     | Custom             |
| generated CFn      |     | existence of       |     | validation based   |
| template against   |     | specific resources |     | on context         |
| a snapshot         |     | or properties      |     |                    |
+--------------------+     +--------------------+     +--------------------+
```

### 5.2 Test Code (TypeScript)

```typescript
// test/app-stack.test.ts
import * as cdk from 'aws-cdk-lib';
import { Template, Match, Capture } from 'aws-cdk-lib/assertions';
import { AppStack } from '../lib/app-stack';
import { NetworkStack } from '../lib/network-stack';
import { DatabaseStack } from '../lib/database-stack';

describe('AppStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const networkStack = new NetworkStack(app, 'TestNetworkStack', {
      environmentName: 'test',
    });
    const databaseStack = new DatabaseStack(app, 'TestDatabaseStack', {
      vpc: networkStack.vpc,
      environmentName: 'test',
    });
    const appStack = new AppStack(app, 'TestAppStack', {
      vpc: networkStack.vpc,
      table: databaseStack.table,
      environmentName: 'test',
    });
    template = Template.fromStack(appStack);
  });

  // Fine-grained assertions
  test('DynamoDB table is created with PAY_PER_REQUEST', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  test('Lambda function is created with the correct runtime', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.12',
      Timeout: 30,
      MemorySize: 256,
      TracingConfig: {
        Mode: 'Active',
      },
    });
  });

  test('Lambda is granted read/write permissions to DynamoDB', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: Match.arrayWith([
              'dynamodb:BatchGetItem',
              'dynamodb:GetItem',
              'dynamodb:PutItem',
            ]),
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });

  // Resource count test
  test('One API Gateway REST API is created', () => {
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  // Test using Capture
  test('TABLE_NAME is set in the Lambda environment variables', () => {
    const envCapture = new Capture();
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          TABLE_NAME: envCapture,
        },
      },
    });
    // Verify the captured value
    expect(envCapture.asObject()).toBeDefined();
  });

  // Verify that a specific resource does not exist
  test('No public S3 buckets are created', () => {
    const resources = template.findResources('AWS::S3::Bucket', {
      Properties: {
        PublicAccessBlockConfiguration: Match.absent(),
      },
    });
    expect(Object.keys(resources)).toHaveLength(0);
  });

  // Snapshot test
  test('Template matches the snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
});
```

### 5.3 Running Tests

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run only a specific test file
npm test -- --testPathPattern app-stack

# Update snapshots
npm test -- -u

# CDK diff (check differences before deployment)
cdk diff

# CDK synth (verify template generation)
cdk synth

# Generate template for a specific stack
cdk synth AppStack > template.yaml
```

### 5.4 Testing with Python

```python
# test/test_app_stack.py
import pytest
import aws_cdk as cdk
from aws_cdk.assertions import Template, Match, Capture

from lib.app_stack import AppStack


@pytest.fixture
def template():
    app = cdk.App()
    stack = AppStack(app, "TestStack", environment_name="test")
    return Template.from_stack(stack)


def test_dynamodb_table_created(template):
    """DynamoDB table is created with the correct configuration"""
    template.has_resource_properties("AWS::DynamoDB::Table", {
        "BillingMode": "PAY_PER_REQUEST",
    })


def test_lambda_function_runtime(template):
    """Lambda function is created with Python 3.12 runtime"""
    template.has_resource_properties("AWS::Lambda::Function", {
        "Runtime": "python3.12",
        "MemorySize": 256,
    })


def test_api_gateway_created(template):
    """One API Gateway is created"""
    template.resource_count_is("AWS::ApiGateway::RestApi", 1)


def test_lambda_has_table_name_env(template):
    """TABLE_NAME environment variable is set in Lambda"""
    env_capture = Capture()
    template.has_resource_properties("AWS::Lambda::Function", {
        "Environment": {
            "Variables": {
                "TABLE_NAME": env_capture,
            },
        },
    })
    assert env_capture.as_object() is not None


def test_no_public_s3_buckets(template):
    """No publicly accessible S3 buckets exist"""
    template.has_resource_properties("AWS::S3::Bucket", {
        "PublicAccessBlockConfiguration": {
            "BlockPublicAcls": True,
            "BlockPublicPolicy": True,
            "IgnorePublicAcls": True,
            "RestrictPublicBuckets": True,
        },
    })
```

---

## 6. CDK Pipelines (Self-Mutation)

### 6.1 CDK Pipelines Concepts

```
CDK Pipelines Self-Mutation:

1. Define the pipeline using CDK
2. The pipeline itself detects changes to the source
3. The pipeline updates itself (Self-Mutation)
4. The updated pipeline deploys the application

┌──────────────────────────────────────────────────────────────┐
│                    CDK Pipeline                              │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐│
│  │ Source    │  │ Build    │  │ Update   │  │ Deploy       ││
│  │ (GitHub) │→│ (Synth)  │→│ Pipeline │→│ Stages       ││
│  │          │  │          │  │ (Self    │  │ (Dev→Stg→Prd)││
│  │          │  │          │  │  Mutate) │  │              ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘│
│                                                              │
│  Self-Mutation: When the pipeline definition changes,        │
│  the pipeline automatically updates itself                   │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Implementing CDK Pipelines

```typescript
// lib/pipeline-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { AppStage } from './app-stage';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Source repository
    const repo = codecommit.Repository.fromRepositoryName(
      this, 'Repo', 'my-cdk-app'
    );

    // Pipeline definition
    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'MyAppPipeline',
      crossAccountKeys: true,
      synth: new pipelines.ShellStep('Synth', {
        input: pipelines.CodePipelineSource.codeCommit(repo, 'main'),
        commands: [
          'npm ci',
          'npm run build',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'cdk.out',
      }),
      // Whether to use Docker builds
      dockerEnabledForSynth: true,
      dockerEnabledForSelfMutation: true,
    });

    // Development environment stage
    const devStage = pipeline.addStage(new AppStage(this, 'Dev', {
      env: { account: '111111111111', region: 'ap-northeast-1' },
      environmentName: 'dev',
    }));

    // Post-deploy tests for the development environment
    devStage.addPost(new pipelines.ShellStep('IntegrationTest', {
      commands: [
        'curl -f $API_URL/health || exit 1',
      ],
      envFromCfnOutputs: {
        API_URL: devStage.apiUrlOutput,
      },
    }));

    // Staging environment stage
    const stagingStage = pipeline.addStage(new AppStage(this, 'Staging', {
      env: { account: '222222222222', region: 'ap-northeast-1' },
      environmentName: 'staging',
    }));

    // Production environment stage (with manual approval)
    const prodStage = pipeline.addStage(new AppStage(this, 'Prod', {
      env: { account: '333333333333', region: 'ap-northeast-1' },
      environmentName: 'prod',
    }));

    prodStage.addPre(new pipelines.ManualApprovalStep('PromoteToProd', {
      comment: 'Please verify the staging environment and approve for production deployment',
    }));
  }
}
```

### 6.3 App Stage Definition

```typescript
// lib/app-stage.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkStack } from './network-stack';
import { DatabaseStack } from './database-stack';
import { AppStack } from './app-stack';

interface AppStageProps extends cdk.StageProps {
  environmentName: string;
}

export class AppStage extends cdk.Stage {
  public readonly apiUrlOutput: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: AppStageProps) {
    super(scope, id, props);

    const networkStack = new NetworkStack(this, 'Network', {
      environmentName: props.environmentName,
    });

    const databaseStack = new DatabaseStack(this, 'Database', {
      vpc: networkStack.vpc,
      environmentName: props.environmentName,
    });

    const appStack = new AppStack(this, 'App', {
      vpc: networkStack.vpc,
      table: databaseStack.table,
      environmentName: props.environmentName,
    });

    this.apiUrlOutput = appStack.apiUrl;
  }
}
```

---

## 7. CDK Deployment Commands

```bash
# Bootstrap (once per account/region)
cdk bootstrap aws://123456789012/ap-northeast-1

# Cross-account bootstrap (configure trust relationship)
cdk bootstrap aws://222222222222/ap-northeast-1 \
  --trust 111111111111 \
  --cloudformation-execution-policies 'arn:aws:iam::aws:policy/AdministratorAccess' \
  --trust-for-lookup 111111111111

# Synthesize template
cdk synth

# Check differences
cdk diff

# Deploy all stacks
cdk deploy --all

# Deploy a specific stack
cdk deploy AppStack

# Deploy with context values
cdk deploy --all --context env=prod --context vpcCidr=10.1.0.0/16

# Deploy without approval prompt (for CI/CD)
cdk deploy --all --require-approval never

# Deploy with rollback disabled (for debugging)
cdk deploy --all --no-rollback

# Hotswap deploy (fast deployment for development environments)
cdk deploy --hotswap

# Watch mode (detect file changes and auto-deploy)
cdk watch

# List stacks
cdk list

# Destroy stacks
cdk destroy --all

# Clear the context cache
cdk context --clear
```

### 7.1 Using Environment Variables

```bash
# Key environment variables for CDK
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=ap-northeast-1
export CDK_NEW_BOOTSTRAP=1

# Specify an AWS profile
cdk deploy --all --profile my-profile

# Verbose mode (debug output)
cdk deploy --all -v

# Get output in JSON format
cdk synth --json
```

---

## 8. CDK Best Practices

### 8.1 Stack Splitting Strategy

```
Recommended Stack Splitting:

1. Lifecycle-based:
   ┌─────────────────────────────────────────────┐
   │ Change frequency: Low → High                 │
   │                                             │
   │ NetworkStack    DatabaseStack    AppStack   │
   │ (VPC, Subnet)  (RDS, DynamoDB)  (Lambda,   │
   │                                  API GW)    │
   │ ~Monthly       Several/month    Daily       │
   └─────────────────────────────────────────────┘

2. Team-based:
   Platform Team → NetworkStack, SecurityStack
   Backend Team  → AppStack, DatabaseStack
   Frontend Team → CDNStack, S3StaticStack

3. Environment-based:
   Dev   → dev-NetworkStack, dev-AppStack, ...
   Stg   → stg-NetworkStack, stg-AppStack, ...
   Prod  → prod-NetworkStack, prod-AppStack, ...
```

### 8.2 Externalizing Configuration

```typescript
// Per-environment configuration files
// config/dev.ts
export const devConfig = {
  environmentName: 'dev',
  vpcCidr: '10.0.0.0/16',
  maxAzs: 2,
  natGateways: 1,
  lambdaMemorySize: 256,
  desiredCount: 1,
  domainName: 'dev.example.com',
  logRetentionDays: 7,
  enableWaf: false,
};

// config/prod.ts
export const prodConfig = {
  environmentName: 'prod',
  vpcCidr: '10.1.0.0/16',
  maxAzs: 3,
  natGateways: 3,
  lambdaMemorySize: 1024,
  desiredCount: 3,
  domainName: 'api.example.com',
  logRetentionDays: 365,
  enableWaf: true,
};

// Use configuration in bin/app.ts
import { devConfig } from '../config/dev';
import { prodConfig } from '../config/prod';

const config = process.env.CDK_ENV === 'prod' ? prodConfig : devConfig;
```

### 8.3 Cross-Cutting Concerns with Aspects

```typescript
// lib/aspects/tagging-aspect.ts
import * as cdk from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * An Aspect that automatically applies mandatory tags to all resources
 */
class MandatoryTagsAspect implements cdk.IAspect {
  constructor(
    private readonly tags: Record<string, string>
  ) {}

  visit(node: IConstruct): void {
    if (cdk.CfnResource.isCfnResource(node)) {
      Object.entries(this.tags).forEach(([key, value]) => {
        cdk.Tags.of(node).add(key, value);
      });
    }
  }
}

/**
 * An Aspect that disallows public access on S3 buckets
 */
class BucketSecurityAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    if (node instanceof cdk.aws_s3.CfnBucket) {
      node.addPropertyOverride('PublicAccessBlockConfiguration', {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
    }
  }
}

/**
 * An Aspect that enforces Lambda function configuration
 */
class LambdaSecurityAspect implements cdk.IAspect {
  visit(node: IConstruct): void {
    if (node instanceof cdk.aws_lambda.CfnFunction) {
      // Enforce X-Ray tracing
      if (!node.tracingConfig) {
        node.addPropertyOverride('TracingConfig.Mode', 'Active');
      }
      // Set a cap on reserved concurrency
      if (!node.reservedConcurrentExecutions) {
        node.addPropertyOverride('ReservedConcurrentExecutions', 100);
      }
    }
  }
}

// Usage example
const app = new cdk.App();
cdk.Aspects.of(app).add(new MandatoryTagsAspect({
  Project: 'MyApp',
  CostCenter: 'Engineering',
  ManagedBy: 'CDK',
}));
cdk.Aspects.of(app).add(new BucketSecurityAspect());
cdk.Aspects.of(app).add(new LambdaSecurityAspect());
```

---

## 9. Construct Hub and Third-Party Constructs

### 9.1 Using Construct Hub

Construct Hub (https://constructs.dev/) is a registry of CDK constructs where you can search and use both official AWS and OSS community constructs.

```bash
# Commonly used third-party constructs
npm install @aws-solutions-constructs/aws-lambda-dynamodb
npm install @aws-solutions-constructs/aws-cloudfront-s3
npm install cdk-nag
```

### 9.2 Security Checks with cdk-nag

```typescript
import { Aspects } from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';

const app = new cdk.App();
// Check against AWS Solutions best practices
Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

// Suppress specific warnings when needed
NagSuppressions.addStackSuppressions(myStack, [
  {
    id: 'AwsSolutions-IAM4',
    reason: 'AWS managed policies are permitted in the development environment',
  },
]);
```

### 9.3 Using AWS Solutions Constructs

```typescript
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';

// Create a best-practice Lambda + DynamoDB configuration in one call
const lambdaDdb = new LambdaToDynamoDB(this, 'LambdaToDdb', {
  lambdaFunctionProps: {
    runtime: lambda.Runtime.PYTHON_3_12,
    code: lambda.Code.fromAsset('lambda/'),
    handler: 'handler.lambda_handler',
  },
  dynamoTableProps: {
    partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  },
});

// Automatically configured:
// - Least-privilege Lambda permissions to DynamoDB
// - CloudWatch Logs for Lambda
// - DynamoDB encryption
// - Dead Letter Queue
```

---

## 10. Anti-Patterns

### 10.1 Hardcoded Values

```typescript
// [Bad example]
const bucket = new s3.Bucket(this, 'Bucket', {
  bucketName: 'my-company-prod-data-bucket',  // Must be changed per environment
});

// [Good example]
const bucket = new s3.Bucket(this, 'Bucket', {
  bucketName: `${props.environmentName}-data-${this.account}`,
  // Or omit bucketName and let CDK auto-generate it
});
```

### 10.2 Overuse of L1 Constructs

**Problem**: Using L1 (CfnXxx) constructs means losing CDK benefits (automatic IAM policy generation, default values, type safety), making it no different from writing CloudFormation directly.

**Solution**: Use L2 constructs wherever possible, and only use `addOverride` or `node.defaultChild` to customize properties not supported by L2.

```typescript
// [Bad example]: Define a VPC with L1
const cfnVpc = new ec2.CfnVPC(this, 'Vpc', {
  cidrBlock: '10.0.0.0/16',
  enableDnsHostnames: true,
  enableDnsSupport: true,
});
// Must manually create subnets, route tables, IGW, NAT GW, etc.

// [Good example]: L2 + escape hatch
const vpc = new ec2.Vpc(this, 'Vpc', {
  maxAzs: 3,
});
// Access L1 to customize
const cfnVpc = vpc.node.defaultChild as ec2.CfnVPC;
cfnVpc.addPropertyOverride('InstanceTenancy', 'dedicated');
```

### 10.3 One Giant Monolithic Stack

```typescript
// [Bad example]: Pack all resources into a single stack
class MonolithStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // VPC, Lambda, DynamoDB, S3, CloudFront, WAF, ...
    // 500+ resources → approaching the CloudFormation limit (500)
    // Deployment takes 30+ minutes
  }
}

// [Good example]: Split stacks by responsibility
// NetworkStack → VPC, Subnet, NAT GW
// DatabaseStack → DynamoDB, RDS
// AppStack → Lambda, API Gateway
// CDNStack → CloudFront, WAF
// MonitoringStack → CloudWatch, SNS
```

### 10.4 Changing Construct IDs

```typescript
// [Danger]: Changing a construct ID changes the resource's logical ID,
// causing the existing resource to be deleted and a new one created
// (risk of data loss for stateful resources)

// Before
const table = new dynamodb.Table(this, 'ItemsTable', { ... });
// After (logical ID changes → table is recreated)
const table = new dynamodb.Table(this, 'ItemsTableV2', { ... });

// Safe approach: set RemovalPolicy.RETAIN in advance
const table = new dynamodb.Table(this, 'ItemsTable', {
  removalPolicy: cdk.RemovalPolicy.RETAIN,  // Retain the table even when the stack is deleted
});
```

---

## 11. FAQ

### Q1. Should I start with CDK or CloudFormation?

If you have programming experience, starting with CDK is recommended. Since CDK generates CloudFormation templates internally, you naturally learn CloudFormation concepts while using CDK. Inspecting the templates generated by `cdk synth` will deepen your understanding.

### Q2. How should CDK version upgrades be managed?

In CDK v2, all modules are consolidated into `aws-cdk-lib`, simplifying version management. Update the `aws-cdk-lib` version in `package.json` and run tests to verify compatibility. Minor version upgrades maintain backward compatibility.

```bash
# Check CDK version
npx cdk --version

# Update packages
npm update aws-cdk-lib constructs

# Update CLI
npm install -g aws-cdk@latest

# Run tests after updating
npm test
cdk diff
```

### Q3. How do you safely manage stateful resources with CDK?

For stateful resources such as DynamoDB tables and RDS instances, set `removalPolicy: RemovalPolicy.RETAIN` so that resources are preserved when the stack is deleted. Also, be careful not to change construct IDs to ensure the resource logical ID remains stable.

### Q4. What can be done when the template generated by `cdk synth` is too large?

The CloudFormation template limit is 1 MB after packaging. For large-scale deployments, split into multiple stacks. Using nested stacks (`NestedStack`) is also an option, but cross-stack references between independent stacks is simpler and recommended in CDK.

### Q5. How do you import existing AWS resources into CDK?

```typescript
// Import an existing VPC
const existingVpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
  vpcId: 'vpc-12345678',
});

// Import an existing S3 bucket
const existingBucket = s3.Bucket.fromBucketName(
  this, 'ExistingBucket', 'my-existing-bucket'
);

// Import an existing DynamoDB table
const existingTable = dynamodb.Table.fromTableName(
  this, 'ExistingTable', 'existing-table'
);

// Import an existing Lambda function
const existingFunction = lambda.Function.fromFunctionArn(
  this, 'ExistingFunc',
  'arn:aws:lambda:ap-northeast-1:123456789012:function:my-function'
);
```

### Q6. How can slow CDK deployments be sped up?

```bash
# Hotswap deploy (supports Lambda, ECS, Step Functions, etc.)
# Updates resources directly without going through CloudFormation
cdk deploy --hotswap

# Watch mode (detect file changes and auto hotswap)
cdk watch

# Parallel deploy (run stacks without dependencies in parallel)
cdk deploy --all --concurrency 5
```

### Q7. How is multi-region deployment implemented?

```typescript
const regions = ['ap-northeast-1', 'us-east-1', 'eu-west-1'];

for (const region of regions) {
  new AppStack(app, `AppStack-${region}`, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region,
    },
    environmentName: 'prod',
  });
}

// When using CloudFormation StackSets, manage via the AWS SDK
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. It is recommended to thoroughly understand the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It is especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|-----------|
| What is CDK | A framework for defining AWS infrastructure with programming languages |
| Constructs | L1 (CFn 1:1), L2 (high-level abstraction), L3 (patterns) |
| Languages | TypeScript, Python, Java, Go, C# |
| Testing | Snapshot tests + fine-grained assertions |
| Deployment | cdk synth -> cdk diff -> cdk deploy |
| CDK Pipelines | Automate CI/CD with self-mutation |
| Aspects | Apply cross-cutting concerns (tagging, security) in bulk |
| Best Practices | Stack splitting, externalized config, security checks with cdk-nag |
| Advantages | Type-safe, testable, IDE completion, native loops/conditions |

---

## What to Read Next

- [CloudFormation](./00-cloudformation.md) -- Understanding the templates generated internally by CDK
- [CodePipeline](./02-codepipeline.md) -- Integrating CDK into CI/CD pipelines
- [Lambda Basics](../05-serverless/00-lambda-basics.md) -- Designing Lambda functions deployed with CDK

---

## References

1. AWS Official Documentation "AWS CDK v2 Developer Guide" https://docs.aws.amazon.com/cdk/v2/guide/
2. AWS CDK API Reference https://docs.aws.amazon.com/cdk/api/v2/
3. CDK Patterns https://cdkpatterns.com/
4. Matt Coulter "The CDK Book" https://www.thecdkbook.com/
5. Construct Hub https://constructs.dev/
6. AWS Solutions Constructs https://docs.aws.amazon.com/solutions/latest/constructs/
7. cdk-nag https://github.com/cdklabs/cdk-nag
