# AWS CodePipeline

> Understand AWS's fully managed CI/CD service and build automated pipelines integrating CodeCommit, CodeBuild, CodeDeploy, and GitHub

## What You Will Learn

1. **Core Concepts of CodePipeline** — Structure of stages, actions, and artifacts
2. **CodeBuild and CodeDeploy Integration** — Automating build, test, and deploy
3. **GitHub Integration and Best Practices** — Integration with GitHub Actions, approval gates, and rollback
4. **Building CodePipeline with CDK** — Managing pipelines as Infrastructure as Code
5. **Pipeline Monitoring and Troubleshooting** — Handling failures with CloudWatch and EventBridge


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with [AWS CDK (Cloud Development Kit)](./01-cdk.md)

---

## 1. What is CodePipeline?

CodePipeline is a continuous delivery service that detects code changes and automatically runs build, test, and deploy processes. It connects stages in sequence to fully automate the software release process.

### Diagram 1: Overall CodePipeline Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CodePipeline                             │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Source    │  │ Build    │  │ Test     │  │ Deploy   │   │
│  │          │→│          │→│          │→│          │   │
│  │ GitHub/  │  │ CodeBuild│  │ CodeBuild│  │ CodeDeploy│  │
│  │ CodeCommit│ │          │  │          │  │ /ECS/    │   │
│  │          │  │          │  │          │  │ Lambda   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              S3 Artifact Store                       │  │
│  │  source.zip → build.zip → test-results → deploy.zip │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Optional stages:                                           │
│  ┌──────────┐  ┌──────────┐                                │
│  │ Approval │  │ Deploy   │                                │
│  │ (Manual) │→│ (Prod)   │                                │
│  └──────────┘  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.1 Key Components of CodePipeline

| Component | Description | Example |
|-----------|-------------|---------|
| **Pipeline** | A collection of stages representing the entire flow from source to deploy | my-app-pipeline |
| **Stage** | A logical phase within the pipeline | Source, Build, Test, Deploy |
| **Action** | An individual task executed within a stage | CodeBuild action, ECS deploy action |
| **Artifact** | Files passed between stages (stored in S3) | SourceOutput, BuildOutput |
| **Transition** | Connection between stages; can be enabled or disabled | Build → Test transition |

### 1.2 New Features in CodePipeline V2

CodePipeline V2 introduced the following features:

- **Trigger filters**: Control pipeline execution by branch name, file path, or tag
- **Extended variables**: Pass variables between stages
- **Execution modes**: QUEUED, SUPERSEDED, and PARALLEL
- **Git tag triggers**: Start pipelines on tag creation or update

```json
{
  "pipeline": {
    "pipelineType": "V2",
    "executionMode": "QUEUED",
    "triggers": [
      {
        "providerType": "CodeStarSourceConnection",
        "gitConfiguration": {
          "sourceActionName": "GitHub-Source",
          "push": [
            {
              "branches": {
                "includes": ["main", "release/*"]
              },
              "filePaths": {
                "includes": ["src/**", "package.json"],
                "excludes": ["docs/**", "*.md"]
              }
            }
          ]
        }
      }
    ]
  }
}
```

---

## 2. Building a Pipeline

### Code Example 1: Creating a Pipeline with the AWS CLI

```bash
# Create a CodeCommit repository
aws codecommit create-repository \
  --repository-name my-app \
  --repository-description "Application repository"

# Create a pipeline using a JSON definition file
aws codepipeline create-pipeline --cli-input-json file://pipeline.json

# Check the pipeline state
aws codepipeline get-pipeline-state --name my-app-pipeline

# Manually trigger the pipeline
aws codepipeline start-pipeline-execution --name my-app-pipeline

# View pipeline execution history
aws codepipeline list-pipeline-executions --pipeline-name my-app-pipeline

# Retry a specific stage
aws codepipeline retry-stage-execution \
  --pipeline-name my-app-pipeline \
  --stage-name Build \
  --pipeline-execution-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" \
  --retry-mode FAILED_ACTIONS
```

### Code Example 1.5: Pipeline Definition JSON

```json
{
  "pipeline": {
    "name": "my-app-pipeline",
    "roleArn": "arn:aws:iam::123456789012:role/CodePipelineRole",
    "artifactStore": {
      "type": "S3",
      "location": "my-pipeline-artifacts-bucket"
    },
    "stages": [
      {
        "name": "Source",
        "actions": [{
          "name": "GitHub-Source",
          "actionTypeId": {
            "category": "Source",
            "owner": "AWS",
            "provider": "CodeStarSourceConnection",
            "version": "1"
          },
          "configuration": {
            "ConnectionArn": "arn:aws:codestar-connections:ap-northeast-1:123456789012:connection/xxx",
            "FullRepositoryId": "my-org/my-app",
            "BranchName": "main",
            "DetectChanges": "true"
          },
          "outputArtifacts": [{"name": "SourceOutput"}]
        }]
      },
      {
        "name": "Build",
        "actions": [{
          "name": "CodeBuild",
          "actionTypeId": {
            "category": "Build",
            "owner": "AWS",
            "provider": "CodeBuild",
            "version": "1"
          },
          "configuration": {
            "ProjectName": "my-app-build"
          },
          "inputArtifacts": [{"name": "SourceOutput"}],
          "outputArtifacts": [{"name": "BuildOutput"}]
        }]
      },
      {
        "name": "Deploy-Staging",
        "actions": [{
          "name": "Deploy-ECS",
          "actionTypeId": {
            "category": "Deploy",
            "owner": "AWS",
            "provider": "ECS",
            "version": "1"
          },
          "configuration": {
            "ClusterName": "my-cluster-staging",
            "ServiceName": "my-service",
            "FileName": "imagedefinitions.json"
          },
          "inputArtifacts": [{"name": "BuildOutput"}]
        }]
      },
      {
        "name": "Approval",
        "actions": [{
          "name": "ManualApproval",
          "actionTypeId": {
            "category": "Approval",
            "owner": "AWS",
            "provider": "Manual",
            "version": "1"
          },
          "configuration": {
            "NotificationArn": "arn:aws:sns:ap-northeast-1:123456789012:deploy-approval",
            "CustomData": "Please verify the staging environment before approving"
          }
        }]
      },
      {
        "name": "Deploy-Production",
        "actions": [{
          "name": "Deploy-ECS",
          "actionTypeId": {
            "category": "Deploy",
            "owner": "AWS",
            "provider": "ECS",
            "version": "1"
          },
          "configuration": {
            "ClusterName": "my-cluster-prod",
            "ServiceName": "my-service",
            "FileName": "imagedefinitions.json"
          },
          "inputArtifacts": [{"name": "BuildOutput"}]
        }]
      }
    ]
  }
}
```

---

## 3. CodeBuild

### 3.1 CodeBuild Environments and Compute Types

| Compute Type | vCPU | Memory | Estimated Monthly Cost (per build minute) | Recommended Use |
|--------------|------|--------|-------------------------------------------|-----------------|
| BUILD_GENERAL1_SMALL | 2 | 3 GB | $0.005/min | Lightweight builds, Lint |
| BUILD_GENERAL1_MEDIUM | 4 | 7 GB | $0.010/min | General builds |
| BUILD_GENERAL1_LARGE | 8 | 15 GB | $0.020/min | Docker builds |
| BUILD_GENERAL1_XLARGE | 36 | 70 GB | $0.040/min | Large-scale builds |
| BUILD_GENERAL1_2XLARGE | 72 | 145 GB | $0.080/min | Monorepos |
| BUILD_LAMBDA_1GB | 2 | 1 GB | $0.00375/min | Lambda environment |
| BUILD_LAMBDA_10GB | 2 | 10 GB | $0.01875/min | Lambda (large) |

### Code Example 2: Creating a buildspec.yml

```yaml
# buildspec.yml
version: 0.2

env:
  variables:
    APP_NAME: my-app
  parameter-store:
    DB_PASSWORD: /myapp/prod/db-password
  secrets-manager:
    API_KEY: myapp/api-key:API_KEY
  exported-variables:
    - BUILD_ID
    - IMAGE_TAG

phases:
  install:
    runtime-versions:
      python: 3.12
      nodejs: 20
    commands:
      - echo "Installing dependencies..."
      - pip install -r requirements.txt
      - npm ci

  pre_build:
    commands:
      - echo "Running linting..."
      - flake8 src/ --max-line-length 120
      - echo "Running security scan..."
      - bandit -r src/ -f json -o reports/bandit.json || true
      - echo "Logging in to ECR..."
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION |
          docker login --username AWS --password-stdin $ECR_REPO_URI
      - export IMAGE_TAG=$CODEBUILD_RESOLVED_SOURCE_VERSION
      - export BUILD_ID=$CODEBUILD_BUILD_NUMBER

  build:
    commands:
      - echo "Running tests..."
      - pytest tests/ -v --junitxml=reports/junit.xml --cov=src --cov-report=xml:reports/coverage.xml
      - echo "Building Docker image..."
      - docker build -t $ECR_REPO_URI:$IMAGE_TAG .
      - docker tag $ECR_REPO_URI:$IMAGE_TAG $ECR_REPO_URI:latest

  post_build:
    commands:
      - echo "Pushing Docker image..."
      - docker push $ECR_REPO_URI:$IMAGE_TAG
      - docker push $ECR_REPO_URI:latest
      - echo "Creating imagedefinitions.json..."
      - printf '[{"name":"app","imageUri":"%s"}]' $ECR_REPO_URI:$IMAGE_TAG > imagedefinitions.json
      - echo "Build completed on $(date)"

reports:
  pytest-reports:
    files:
      - "reports/junit.xml"
    file-format: JUNITXML
  coverage-reports:
    files:
      - "reports/coverage.xml"
    file-format: COBERTURAXML

artifacts:
  files:
    - imagedefinitions.json
    - appspec.yml
    - taskdef.json
  secondary-artifacts:
    test-reports:
      files:
        - "reports/**/*"
      base-directory: .

cache:
  paths:
    - "/root/.cache/pip/**/*"
    - "node_modules/**/*"
    - "/root/.docker/**/*"
```

### 3.2 Multi-Stage buildspec (Separating Test and Build)

```yaml
# buildspec-test.yml (test-only)
version: 0.2

phases:
  install:
    runtime-versions:
      python: 3.12
    commands:
      - pip install -r requirements.txt -r requirements-dev.txt

  build:
    commands:
      # Unit tests
      - pytest tests/unit/ -v --junitxml=reports/unit-test.xml
      # Integration tests
      - pytest tests/integration/ -v --junitxml=reports/integration-test.xml
      # Coverage
      - pytest tests/ --cov=src --cov-report=xml:reports/coverage.xml --cov-fail-under=80
      # Security scan
      - safety check --json --output reports/safety.json || true
      - bandit -r src/ -f json -o reports/bandit.json || true

reports:
  unit-tests:
    files:
      - "reports/unit-test.xml"
    file-format: JUNITXML
  integration-tests:
    files:
      - "reports/integration-test.xml"
    file-format: JUNITXML
  coverage:
    files:
      - "reports/coverage.xml"
    file-format: COBERTURAXML
```

```yaml
# buildspec-build.yml (build-only)
version: 0.2

phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION |
          docker login --username AWS --password-stdin $ECR_REPO_URI
      - export IMAGE_TAG=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | head -c 8)

  build:
    commands:
      - docker build \
          --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
          --build-arg VCS_REF=$CODEBUILD_RESOLVED_SOURCE_VERSION \
          --cache-from $ECR_REPO_URI:latest \
          -t $ECR_REPO_URI:$IMAGE_TAG \
          -t $ECR_REPO_URI:latest \
          .

  post_build:
    commands:
      - docker push $ECR_REPO_URI:$IMAGE_TAG
      - docker push $ECR_REPO_URI:latest
      - printf '[{"name":"app","imageUri":"%s"}]' $ECR_REPO_URI:$IMAGE_TAG > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json
    - appspec.yml
    - taskdef.json
```

### Code Example 3: Creating a CodeBuild Project

```bash
aws codebuild create-project \
  --name my-app-build \
  --source type=CODEPIPELINE \
  --environment '{
    "type": "LINUX_CONTAINER",
    "image": "aws/codebuild/amazonlinux2-x86_64-standard:5.0",
    "computeType": "BUILD_GENERAL1_MEDIUM",
    "privilegedMode": true,
    "environmentVariables": [
      {"name": "ECR_REPO_URI", "value": "123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/my-app"},
      {"name": "AWS_DEFAULT_REGION", "value": "ap-northeast-1"}
    ]
  }' \
  --service-role arn:aws:iam::123456789012:role/CodeBuildRole \
  --artifacts type=CODEPIPELINE
```

### 3.3 CodeBuild Cache Strategies

```bash
# S3 cache (shared across builds)
aws codebuild update-project \
  --name my-app-build \
  --cache '{
    "type": "S3",
    "location": "my-codebuild-cache/my-app"
  }'

# Local cache (shared within the same build host)
aws codebuild update-project \
  --name my-app-build \
  --cache '{
    "type": "LOCAL",
    "modes": [
      "LOCAL_DOCKER_LAYER_CACHE",
      "LOCAL_SOURCE_CACHE",
      "LOCAL_CUSTOM_CACHE"
    ]
  }'
```

### 3.4 CodeBuild Batch Builds

```yaml
# buildspec-batch.yml
version: 0.2

batch:
  fast-fail: true
  build-graph:
    - identifier: lint
      buildspec: buildspec-lint.yml
    - identifier: unit_test
      buildspec: buildspec-unit-test.yml
    - identifier: integration_test
      buildspec: buildspec-integration-test.yml
      depend-on:
        - lint
    - identifier: build
      buildspec: buildspec-build.yml
      depend-on:
        - unit_test
        - integration_test
```

---

## 4. CodeDeploy

### Diagram 2: CodeDeploy Deployment Strategies

```
1. In-Place:
   ┌────────┐  ┌────────┐  ┌────────┐
   │ EC2-1  │  │ EC2-2  │  │ EC2-3  │
   │  v1    │  │  v1    │  │  v1    │
   └───┬────┘  └────────┘  └────────┘
       │ deploy
       ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │ EC2-1  │  │ EC2-2  │  │ EC2-3  │
   │  v2    │  │  v1    │  │  v1    │
   └────────┘  └───┬────┘  └────────┘
                   │ deploy
                   ▼ ... sequential

2. Blue/Green (ECS):
   ┌─────────────────────────────────┐
   │            ALB                  │
   │     ┌──────┴──────┐            │
   │     ▼             ▼            │
   │  ┌──────┐    ┌──────┐         │
   │  │Blue  │    │Green │         │
   │  │(v1)  │    │(v2)  │         │
   │  │100%  │    │ 0%   │         │
   │  └──────┘    └──────┘         │
   └─────────────────────────────────┘
        │ traffic shift (Linear/Canary/AllAtOnce)
        ▼
   ┌─────────────────────────────────┐
   │            ALB                  │
   │     ┌──────┴──────┐            │
   │     ▼             ▼            │
   │  ┌──────┐    ┌──────┐         │
   │  │Blue  │    │Green │         │
   │  │(v1)  │    │(v2)  │         │
   │  │ 0%   │    │100%  │         │
   │  └──────┘    └──────┘         │
   └─────────────────────────────────┘

3. Lambda (Canary/Linear):
   v1: 100% ──→ v1: 90% / v2: 10% ──→ v1: 0% / v2: 100%
   (Canary10Percent5Minutes / Linear10PercentEvery1Minute)
```

### Code Example 4: appspec.yml (ECS Blue/Green)

```yaml
# appspec.yml (ECS)
version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: <TASK_DEFINITION>
        LoadBalancerInfo:
          ContainerName: "app"
          ContainerPort: 8080
        PlatformVersion: "LATEST"
        CapacityProviderStrategy:
          - Base: 1
            CapacityProvider: "FARGATE"
            Weight: 1

Hooks:
  - BeforeInstall: "LambdaFunctionToValidateBeforeInstall"
  - AfterInstall: "LambdaFunctionToValidateAfterInstall"
  - AfterAllowTestTraffic: "LambdaFunctionToRunIntegrationTests"
  - BeforeAllowTraffic: "LambdaFunctionToValidateBeforeTraffic"
  - AfterAllowTraffic: "LambdaFunctionToRunSmokeTests"
```

### 4.1 ECS Blue/Green Deployment Configuration

```bash
# Create a CodeDeploy application
aws deploy create-application \
  --application-name my-ecs-app \
  --compute-platform ECS

# Create a deployment group (Canary deployment)
aws deploy create-deployment-group \
  --application-name my-ecs-app \
  --deployment-group-name my-ecs-dg \
  --service-role-arn arn:aws:iam::123456789012:role/CodeDeployECSRole \
  --deployment-config-name CodeDeployDefault.ECSCanary10Percent5Minutes \
  --ecs-services '[{
    "serviceName": "my-service",
    "clusterName": "my-cluster"
  }]' \
  --load-balancer-info '{
    "targetGroupPairInfoList": [{
      "targetGroups": [
        {"name": "my-tg-blue"},
        {"name": "my-tg-green"}
      ],
      "prodTrafficRoute": {
        "listenerArns": [
          "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:listener/app/my-alb/xxx/yyy"
        ]
      },
      "testTrafficRoute": {
        "listenerArns": [
          "arn:aws:elasticloadbalancing:ap-northeast-1:123456789012:listener/app/my-alb/xxx/zzz"
        ]
      }
    }]
  }' \
  --blue-green-deployment-configuration '{
    "terminateBlueInstancesOnDeploymentSuccess": {
      "action": "TERMINATE",
      "terminationWaitTimeInMinutes": 60
    },
    "deploymentReadyOption": {
      "actionOnTimeout": "CONTINUE_DEPLOYMENT",
      "waitTimeInMinutes": 0
    }
  }' \
  --auto-rollback-configuration '{
    "enabled": true,
    "events": ["DEPLOYMENT_FAILURE", "DEPLOYMENT_STOP_ON_ALARM"]
  }' \
  --alarm-configuration '{
    "enabled": true,
    "alarms": [
      {"name": "my-ecs-5xx-alarm"},
      {"name": "my-ecs-latency-alarm"}
    ]
  }'
```

### 4.2 Deployment Configuration Comparison

| Deployment Config Name | Strategy | Traffic Shift | Use Case |
|------------------------|----------|---------------|----------|
| CodeDeployDefault.ECSAllAtOnce | All-at-once | Immediate 100% | Development environment |
| CodeDeployDefault.ECSLinear10PercentEvery1Minute | Linear | 10% every 1 minute | Test environment |
| CodeDeployDefault.ECSLinear10PercentEvery3Minutes | Linear | 10% every 3 minutes | Staging |
| CodeDeployDefault.ECSCanary10Percent5Minutes | Canary | 10% → wait 5 min → 90% | Recommended for production |
| CodeDeployDefault.ECSCanary10Percent15Minutes | Canary | 10% → wait 15 min → 90% | High-safety production |

### 4.3 Lambda Deployment Lifecycle Hooks

```python
# hooks/validate_after_install.py
"""CodeDeploy lifecycle hook: post-deployment validation"""
import boto3
import json
import urllib3

codedeploy = boto3.client("codedeploy")
http = urllib3.PoolManager()


def handler(event, context):
    deployment_id = event["DeploymentId"]
    lifecycle_event_hook_execution_id = event["LifecycleEventHookExecutionId"]

    try:
        # Health check
        response = http.request("GET", "http://localhost:8080/health", timeout=10)

        if response.status == 200:
            status = "Succeeded"
            print(f"Health check passed: {response.data.decode()}")
        else:
            status = "Failed"
            print(f"Health check failed: status={response.status}")

    except Exception as e:
        status = "Failed"
        print(f"Health check error: {str(e)}")

    # Report result to CodeDeploy
    codedeploy.put_lifecycle_event_hook_execution_status(
        deploymentId=deployment_id,
        lifecycleEventHookExecutionId=lifecycle_event_hook_execution_id,
        status=status,
    )

    return {"statusCode": 200, "body": json.dumps({"status": status})}
```

---

## 5. Building CodePipeline with CDK

### Code Example 5: Building a Pipeline with CDK

```typescript
import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events_targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

interface PipelineStackProps extends cdk.StackProps {
  ecrRepository: ecr.Repository;
  ecsClusterStaging: ecs.Cluster;
  ecsClusterProd: ecs.Cluster;
  ecsServiceStaging: ecs.FargateService;
  ecsServiceProd: ecs.FargateService;
  notificationEmail: string;
}

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    // SNS topic (for approval notifications)
    const approvalTopic = new sns.Topic(this, 'ApprovalTopic', {
      displayName: 'Deploy Approval Notifications',
    });
    approvalTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.notificationEmail)
    );

    // SNS topic for pipeline failure notifications
    const failureTopic = new sns.Topic(this, 'FailureTopic', {
      displayName: 'Pipeline Failure Notifications',
    });
    failureTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.notificationEmail)
    );

    // Artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');
    const testOutput = new codepipeline.Artifact('TestOutput');

    // CodeBuild project (test)
    const testProject = new codebuild.PipelineProject(this, 'TestProject', {
      projectName: 'my-app-test',
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec-test.yml'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
      },
      timeout: cdk.Duration.minutes(15),
    });

    // CodeBuild project (build)
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: 'my-app-build',
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec-build.yml'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true, // Required for Docker builds
        environmentVariables: {
          ECR_REPO_URI: {
            value: props.ecrRepository.repositoryUri,
          },
          AWS_DEFAULT_REGION: {
            value: this.region,
          },
        },
      },
      cache: codebuild.Cache.local(
        codebuild.LocalCacheMode.DOCKER_LAYER,
        codebuild.LocalCacheMode.CUSTOM,
      ),
      timeout: cdk.Duration.minutes(30),
    });

    // Grant push permissions to ECR
    props.ecrRepository.grantPullPush(buildProject);

    // Pipeline
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: 'my-app-pipeline',
      crossAccountKeys: false,
      restartExecutionOnUpdate: true,
    });

    // Source stage
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeStarConnectionsSourceAction({
          actionName: 'GitHub-Source',
          connectionArn: 'arn:aws:codestar-connections:ap-northeast-1:123456789012:connection/xxx',
          owner: 'my-org',
          repo: 'my-app',
          branch: 'main',
          output: sourceOutput,
          triggerOnPush: true,
        }),
      ],
    });

    // Test stage
    pipeline.addStage({
      stageName: 'Test',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'UnitTest',
          project: testProject,
          input: sourceOutput,
          outputs: [testOutput],
        }),
      ],
    });

    // Build stage
    pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'DockerBuild',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // Staging deploy
    pipeline.addStage({
      stageName: 'Deploy-Staging',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'Deploy-ECS-Staging',
          service: props.ecsServiceStaging,
          input: buildOutput,
        }),
      ],
    });

    // Manual approval
    pipeline.addStage({
      stageName: 'Approval',
      actions: [
        new codepipeline_actions.ManualApprovalAction({
          actionName: 'Approve-Production',
          notificationTopic: approvalTopic,
          additionalInformation: 'Please approve after confirming the staging environment is working correctly',
          externalEntityUrl: 'https://staging.example.com',
        }),
      ],
    });

    // Production deploy
    pipeline.addStage({
      stageName: 'Deploy-Production',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'Deploy-ECS-Production',
          service: props.ecsServiceProd,
          input: buildOutput,
        }),
      ],
    });

    // Notification on pipeline failure
    pipeline.onStateChange('PipelineStateChange', {
      target: new events_targets.SnsTopic(failureTopic),
      eventPattern: {
        detail: {
          state: ['FAILED'],
        },
      },
    });
  }
}
```

---

## 6. Complete Pipeline with Terraform

### Code Example 6: Building a Pipeline with Terraform

```hcl
# CodeStar Connection (GitHub integration)
resource "aws_codestarconnections_connection" "github" {
  name          = "github-connection"
  provider_type = "GitHub"
}

# CodeBuild project
resource "aws_codebuild_project" "app" {
  name         = "my-app-build"
  service_role = aws_iam_role.codebuild.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_MEDIUM"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true

    environment_variable {
      name  = "ECR_REPO_URI"
      value = aws_ecr_repository.app.repository_url
    }
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  cache {
    type  = "S3"
    location = "${aws_s3_bucket.cache.bucket}/build-cache"
  }

  logs_config {
    cloudwatch_logs {
      group_name  = "/codebuild/my-app-build"
      stream_name = ""
    }
    s3_logs {
      status   = "ENABLED"
      location = "${aws_s3_bucket.logs.bucket}/codebuild-logs"
    }
  }
}

# CodePipeline
resource "aws_codepipeline" "app" {
  name     = "my-app-pipeline"
  role_arn = aws_iam_role.codepipeline.arn

  artifact_store {
    location = aws_s3_bucket.artifacts.bucket
    type     = "S3"

    encryption_key {
      id   = aws_kms_key.pipeline.arn
      type = "KMS"
    }
  }

  # Source stage
  stage {
    name = "Source"
    action {
      name             = "GitHub"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      version          = "1"
      output_artifacts = ["source_output"]

      configuration = {
        ConnectionArn    = aws_codestarconnections_connection.github.arn
        FullRepositoryId = "my-org/my-app"
        BranchName       = "main"
        DetectChanges    = "true"
      }
    }
  }

  # Build stage
  stage {
    name = "Build"
    action {
      name             = "Build"
      category         = "Build"
      owner            = "AWS"
      provider         = "CodeBuild"
      version          = "1"
      input_artifacts  = ["source_output"]
      output_artifacts = ["build_output"]

      configuration = {
        ProjectName = aws_codebuild_project.app.name
      }
    }
  }

  # Staging deploy
  stage {
    name = "Deploy-Staging"
    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ClusterName = "staging-cluster"
        ServiceName = "my-service"
        FileName    = "imagedefinitions.json"
      }
    }
  }

  # Manual approval
  stage {
    name = "Approval"
    action {
      name     = "Approve"
      category = "Approval"
      owner    = "AWS"
      provider = "Manual"
      version  = "1"

      configuration = {
        NotificationArn = aws_sns_topic.approval.arn
        CustomData      = "Please approve production deployment after verifying staging"
      }
    }
  }

  # Production deploy
  stage {
    name = "Deploy-Production"
    action {
      name            = "Deploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      version         = "1"
      input_artifacts = ["build_output"]

      configuration = {
        ClusterName = "production-cluster"
        ServiceName = "my-service"
        FileName    = "imagedefinitions.json"
      }
    }
  }
}

# EventBridge rule for pipeline failures
resource "aws_cloudwatch_event_rule" "pipeline_failure" {
  name        = "pipeline-failure-notification"
  description = "Notification on pipeline failure"

  event_pattern = jsonencode({
    source      = ["aws.codepipeline"]
    detail-type = ["CodePipeline Pipeline Execution State Change"]
    detail = {
      pipeline = [aws_codepipeline.app.name]
      state    = ["FAILED"]
    }
  })
}

resource "aws_cloudwatch_event_target" "pipeline_failure_sns" {
  rule      = aws_cloudwatch_event_rule.pipeline_failure.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.failure.arn
}

# IAM role: CodePipeline
resource "aws_iam_role" "codepipeline" {
  name = "CodePipelineRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "codepipeline.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "codepipeline" {
  name = "CodePipelinePolicy"
  role = aws_iam_role.codepipeline.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:GetBucketVersioning"
        ]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "codebuild:BatchGetBuilds",
          "codebuild:StartBuild"
        ]
        Resource = aws_codebuild_project.app.arn
      },
      {
        Effect   = "Allow"
        Action   = ["codestar-connections:UseConnection"]
        Resource = aws_codestarconnections_connection.github.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:DescribeTasks",
          "ecs:ListTasks",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService"
        ]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = "iam:PassRole"
        Resource = "*"
        Condition = {
          StringEqualsIfExists = {
            "iam:PassedToService" = [
              "ecs-tasks.amazonaws.com"
            ]
          }
        }
      },
      {
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.approval.arn
      }
    ]
  })
}
```

---

## 7. Comparison Tables

### Comparison Table 1: AWS CI/CD Services

| Item | CodePipeline | CodeBuild | CodeDeploy | GitHub Actions |
|------|-------------|-----------|------------|---------------|
| **Category** | Orchestration | Build/Test | Deploy | CI/CD integrated |
| **Runtime** | AWS managed | AWS managed | Agent-based | GitHub hosted |
| **Billing** | Per pipeline/month | Per build minute | Per deployment | Per minute |
| **GitHub integration** | CodeStar Connection | Webhook | None | Native |
| **ECS deploy** | ECS action | None | Blue/Green | aws-actions |
| **Lambda deploy** | Lambda action | SAM deploy | Canary | SAM CLI |
| **Approval gates** | Yes | None | None | Environment Protection |
| **Pipeline as Code** | JSON/CDK | buildspec.yml | appspec.yml | YAML workflow |
| **Self-hosted runners** | None | None | EC2 agent | Yes |
| **Parallel execution** | Actions within stage | Batch builds | None | matrix |

### Comparison Table 2: Deployment Strategy Comparison

| Strategy | Downtime | Rollback | Risk | Cost |
|----------|----------|----------|------|------|
| **All-at-once** | Yes | Manual redeploy | High | Lowest |
| **Rolling** | Minimal | Manual | Medium | Low |
| **Blue/Green** | None | Immediate (traffic switch) | Low | High (2x resources) |
| **Canary** | None | Automatic (metric-based) | Lowest | Medium |
| **Linear** | None | Automatic | Low | Medium |

### Comparison Table 3: CodePipeline V1 vs V2

| Feature | V1 | V2 |
|---------|-----|-----|
| Trigger filters | None | Branch, file path, tag |
| Execution modes | SUPERSEDED only | QUEUED, SUPERSEDED, PARALLEL |
| Variables | Limited | Pass variables between stages |
| Pricing | $1/pipeline/month | $1/pipeline/month + action fees |
| Git tag triggers | None | Yes |

---

## 8. Diagram 3: GitHub Actions Integration Patterns

```
Pattern 1: GitHub Actions → AWS Deploy
  ┌─────────────┐     ┌───────────────┐     ┌──────────┐
  │ GitHub      │     │ GitHub Actions│     │ AWS      │
  │ push/PR     │ ──→ │ Build & Test  │ ──→ │ ECS/     │
  │             │     │ Docker Build  │     │ Lambda   │
  └─────────────┘     └───────────────┘     └──────────┘
  * Assumes IAM role via OIDC (no access keys required)

Pattern 2: GitHub → CodePipeline
  ┌─────────────┐     ┌───────────────┐     ┌──────────┐
  │ GitHub      │     │ CodePipeline  │     │ AWS      │
  │ push        │ ──→ │ CodeBuild     │ ──→ │ CodeDeploy│
  │             │     │ (buildspec)   │     │ Blue/Green│
  └─────────────┘     └───────────────┘     └──────────┘
  * Connected via CodeStar Connection

Pattern 3: Hybrid
  ┌─────────────┐     ┌───────────────┐
  │ GitHub      │     │ GitHub Actions│
  │ push/PR     │ ──→ │ Lint & Test   │ ← CI (GitHub)
  │             │     └───────┬───────┘
  │             │             │ merge to main
  │             │             ▼
  │             │     ┌───────────────┐
  │             │     │ CodePipeline  │ ← CD (AWS)
  │             │     │ Build → Deploy│
  │             │     └───────────────┘
  └─────────────┘
```

### Code Example 7: Deploying to AWS with GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS ECS

on:
  push:
    branches: [main]

permissions:
  id-token: write   # OIDC
  contents: read

env:
  AWS_REGION: ap-northeast-1
  ECR_REPOSITORY: my-app
  ECS_CLUSTER: production-cluster
  ECS_SERVICE: my-service

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - name: Install Dependencies
        run: pip install -r requirements.txt -r requirements-dev.txt

      - name: Run Tests
        run: pytest tests/ -v --junitxml=reports/junit.xml --cov=src --cov-report=xml

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: reports/

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: ecr-login
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Docker Image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Download Task Definition
        run: |
          aws ecs describe-task-definition \
            --task-definition my-task \
            --query taskDefinition > task-definition.json

      - name: Update Task Definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: task-definition.json
          container-name: app
          image: ${{ steps.ecr-login.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
          wait-for-minutes: 10

      - name: Notify on Failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deploy FAILED: ${{ github.repository }}@${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Code Example 8: Configuring the OIDC Provider (CloudFormation)

```yaml
# github-oidc.yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: GitHub Actions OIDC Provider and IAM Role

Resources:
  GitHubOIDCProvider:
    Type: AWS::IAM::OIDCProvider
    Properties:
      Url: https://token.actions.githubusercontent.com
      ClientIdList:
        - sts.amazonaws.com
      ThumbprintList:
        - 6938fd4d98bab03faadb97b34396831e3780aea1

  GitHubActionsRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: GitHubActionsRole
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Federated: !GetAtt GitHubOIDCProvider.Arn
            Action: sts:AssumeRoleWithWebIdentity
            Condition:
              StringEquals:
                "token.actions.githubusercontent.com:aud": sts.amazonaws.com
              StringLike:
                "token.actions.githubusercontent.com:sub":
                  - "repo:my-org/my-app:ref:refs/heads/main"
                  - "repo:my-org/my-app:environment:production"
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
      Policies:
        - PolicyName: ECSDeployPolicy
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Effect: Allow
                Action:
                  - ecs:DescribeServices
                  - ecs:DescribeTaskDefinition
                  - ecs:DescribeTasks
                  - ecs:ListTasks
                  - ecs:RegisterTaskDefinition
                  - ecs:UpdateService
                Resource: "*"
              - Effect: Allow
                Action: iam:PassRole
                Resource: "*"
                Condition:
                  StringEqualsIfExists:
                    "iam:PassedToService": ecs-tasks.amazonaws.com
```

---

## 9. Pipeline Monitoring and Troubleshooting

### 9.1 Monitoring Pipeline Events with EventBridge

```bash
# Rule to monitor pipeline state changes
aws events put-rule \
  --name "pipeline-state-change" \
  --event-pattern '{
    "source": ["aws.codepipeline"],
    "detail-type": ["CodePipeline Pipeline Execution State Change"],
    "detail": {
      "pipeline": ["my-app-pipeline"],
      "state": ["FAILED", "SUCCEEDED"]
    }
  }'

# Send Slack notification via Lambda target
aws events put-targets \
  --rule "pipeline-state-change" \
  --targets '[{
    "Id": "SlackNotification",
    "Arn": "arn:aws:lambda:ap-northeast-1:123456789012:function:slack-notify"
  }]'
```

### 9.2 Slack Notification Lambda

```python
# slack_notify.py
import json
import os
import urllib3

SLACK_WEBHOOK_URL = os.environ["SLACK_WEBHOOK_URL"]
http = urllib3.PoolManager()


def handler(event, context):
    detail = event["detail"]
    pipeline = detail["pipeline"]
    state = detail["state"]
    execution_id = detail["execution-id"]

    color_map = {
        "SUCCEEDED": "#36a64f",
        "FAILED": "#ff0000",
        "STARTED": "#439FE0",
    }

    emoji_map = {
        "SUCCEEDED": ":white_check_mark:",
        "FAILED": ":x:",
        "STARTED": ":rocket:",
    }

    message = {
        "attachments": [
            {
                "color": color_map.get(state, "#808080"),
                "blocks": [
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": (
                                f"{emoji_map.get(state, '')} *Pipeline {state}*\n"
                                f"*Pipeline:* {pipeline}\n"
                                f"*Execution ID:* `{execution_id}`\n"
                                f"*Region:* {event['region']}"
                            ),
                        },
                    }
                ],
            }
        ]
    }

    response = http.request(
        "POST",
        SLACK_WEBHOOK_URL,
        body=json.dumps(message).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    return {"statusCode": response.status}
```

### 9.3 CloudWatch Dashboard

```bash
# Create a metrics dashboard for the pipeline
aws cloudwatch put-dashboard \
  --dashboard-name "CICD-Dashboard" \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "title": "Pipeline Execution Duration",
          "metrics": [
            ["AWS/CodePipeline", "PipelineExecutionTime",
             "PipelineName", "my-app-pipeline",
             {"stat": "Average", "period": 86400}]
          ],
          "view": "timeSeries",
          "period": 86400
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "Pipeline Success Rate",
          "metrics": [
            ["AWS/CodePipeline", "PipelineExecutionSucceeded",
             "PipelineName", "my-app-pipeline",
             {"stat": "Sum", "period": 86400}],
            ["AWS/CodePipeline", "PipelineExecutionFailed",
             "PipelineName", "my-app-pipeline",
             {"stat": "Sum", "period": 86400}]
          ],
          "view": "timeSeries"
        }
      },
      {
        "type": "metric",
        "properties": {
          "title": "CodeBuild Duration",
          "metrics": [
            ["AWS/CodeBuild", "Duration",
             "ProjectName", "my-app-build",
             {"stat": "Average"}]
          ],
          "view": "timeSeries"
        }
      }
    ]
  }'
```

### 9.4 Common Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Source stage failure | CodeStar Connection is in pending state | Manually approve the connection in the AWS console |
| Build stage timeout | Docker build is slow | Enable caching, change compute type |
| Deploy stage failure | Task definition image mismatch | Verify the format of imagedefinitions.json |
| Permission error | Insufficient IAM role | Add policies to CodePipeline/CodeBuild roles |
| Artifact S3 error | Bucket policy issue | Check KMS key policy and S3 bucket policy |
| ECS service instability | Health check failure | Verify target group health check settings |

---

## 10. Anti-Patterns

### Anti-Pattern 1: Direct Production Deploy (No Approval Gate)

```
[Bad]
  Source → Build → Deploy (production)
  → No tests, no approval
  → Bugs reach production immediately

[Good]
  Source → Build → Test → Deploy(Staging) → Manual Approval → Deploy(Production)
  → Verify behavior in staging environment
  → Insert human review via manual approval
  → Stop the pipeline if issues are found
```

### Anti-Pattern 2: Hardcoding Secrets in Builds

```
[Bad]
  # buildspec.yml
  phases:
    build:
      commands:
        - export DB_PASSWORD="MySecret123"  # Hardcoded!
        - export API_KEY="sk-abc123"         # Goes into version control!

[Good]
  # buildspec.yml
  env:
    parameter-store:
      DB_PASSWORD: /myapp/prod/db-password
    secrets-manager:
      API_KEY: myapp/api-key:API_KEY

  # Or reference Parameter Store via CodeBuild environment variables
  aws codebuild update-project \
    --name my-build \
    --environment '{
      "environmentVariables": [{
        "name": "DB_PASSWORD",
        "value": "/myapp/prod/db-password",
        "type": "PARAMETER_STORE"
      }]
    }'
```

### Anti-Pattern 3: Overly Broad IAM Permissions for the Pipeline Role

```
[Bad]
  {
    "Effect": "Allow",
    "Action": "*",
    "Resource": "*"
  }
  → All operations on all services are permitted
  → Extremely high security risk

[Good]
  Pipeline role:
  - codepipeline:* → own pipeline only
  - s3:GetObject/PutObject → artifact bucket only
  - codebuild:StartBuild → specified project only

  CodeBuild role:
  - ecr:GetAuthorizationToken, ecr:BatchGetImage → specified repository only
  - logs:CreateLogGroup, PutLogEvents → specified log group only
  - s3:GetObject → cache bucket only
```

### Anti-Pattern 4: Automatic Deploy Without Tests

```
[Bad]
  Source → Build → Deploy
  → Compiles but no tests
  → Runtime errors discovered in production

[Good]
  Source → Lint → Unit Test → Integration Test → Build → Deploy
  → Static analysis with linter
  → Logic verification with unit tests
  → External service integration verification with integration tests
  → Gate on test coverage threshold
```

---

## 11. FAQ

### Q1: Should I use CodePipeline or GitHub Actions?

**A:** If your team develops around GitHub, it is more efficient to handle CI/CD entirely in GitHub Actions. If you need advanced deployment features from AWS services (ECS Blue/Green, CodeDeploy Canary), choose CodePipeline or a hybrid setup with GitHub Actions for CI and CodePipeline for CD. Using OIDC integration allows you to deploy to AWS from GitHub Actions securely.

### Q2: How do I roll back when a pipeline fails?

**A:** For ECS Blue/Green deployments, CodeDeploy automatically rolls back when it detects health check failures. Manual rollback can be performed with `aws deploy stop-deployment`. Lambda canary deployments also support automatic rollback based on CloudWatch alarms. For EC2 In-Place deployments, rollback is difficult, so Blue/Green is recommended.

### Q3: How can I shorten build times?

**A:** (1) Use CodeBuild caching (S3 or local cache) to skip downloading dependencies, (2) leverage layer caching with multi-stage Docker builds, (3) increase the CodeBuild compute type (MEDIUM → LARGE), (4) run tests in parallel, (5) adopt a monorepo strategy that builds only changed packages.

### Q4: Should I migrate to CodePipeline V2?

**A:** Migration to V2 is recommended if you need branch filters, file path filters, or pipeline execution queuing. V2 significantly improves trigger flexibility, reducing unnecessary pipeline executions. Existing V1 pipelines continue to be supported, so choosing V2 for new pipelines is the most natural migration path.

### Q5: How should I design a pipeline for a monorepo?

**A:** The recommended approach is to use CodePipeline V2 file path filters to trigger different pipelines based on which directory changed. Alternatively, implement change detection logic in CodeBuild batch builds to build and deploy only affected services. For GitHub Actions, combining `paths` filters with matrix builds is effective.

---


## FAQ

### Q1: What is the most important point to understand when learning this topic?

Gaining hands-on experience is the most important thing. Understanding deepens not just through theory but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping straight to advanced topics. We recommend fully understanding the basic concepts explained in this guide before moving on to the next steps.

### Q3: How is this used in real-world practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architectural design.

---

## Summary

| Item | Key Points |
|------|------------|
| Pipeline structure | Source → Build → Test → Staging → Approval → Production |
| Source integration | Connect GitHub via CodeStar Connection. OIDC authentication recommended |
| Build | Defined in CodeBuild's buildspec.yml. Use caching to speed up |
| Deployment strategy | Use Blue/Green or Canary for production. Automate rollback |
| Secrets | Reference from Parameter Store / Secrets Manager. Never hardcode |
| Approval gate | Add a manual approval stage before production deployment |
| Monitoring | Notify on pipeline failures with EventBridge + CloudWatch |
| CDK integration | Build self-mutating pipelines with CDK Pipelines |
| IAM | Principle of least privilege. Grant only necessary permissions to pipeline/CodeBuild roles |

---

## Further Reading

- [00-iam-deep-dive.md](../08-security/00-iam-deep-dive.md) — IAM role design for pipelines
- [01-secrets-management.md](../08-security/01-secrets-management.md) — Managing secrets during builds
- [00-cost-optimization.md](../09-cost/00-cost-optimization.md) — Optimizing CI/CD costs

---

## References

1. **AWS Official Documentation** — AWS CodePipeline User Guide
   https://docs.aws.amazon.com/codepipeline/latest/userguide/
2. **AWS CodeBuild User Guide** — buildspec reference and best practices
   https://docs.aws.amazon.com/codebuild/latest/userguide/
3. **GitHub Actions — AWS Deploy** — Official guide for OIDC and aws-actions
   https://docs.github.com/en/actions/deployment/deploying-to-aws
4. **AWS CDK Pipelines** — Developer guide for CDK Pipelines
   https://docs.aws.amazon.com/cdk/v2/guide/cdk_pipeline.html
5. **AWS CodeDeploy** — Blue/Green deployment configuration guide
   https://docs.aws.amazon.com/codedeploy/latest/userguide/
