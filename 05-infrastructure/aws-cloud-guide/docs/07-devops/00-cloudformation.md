# AWS CloudFormation

> Systematically learn CloudFormation for defining and managing AWS resources as code — covering template syntax, stack management, cross-stack references, and drift detection. Includes practical operational knowledge spanning custom resources, macros, stack sets, CI/CD integration, and troubleshooting.

---

## What You Will Learn

1. **Understanding Template Syntax** -- Master resource definitions, parameters, mappings, conditions, and intrinsic functions using YAML/JSON
2. **Stack Management and Operations** -- Understand stack creation, updates, deletion, change sets, and nested stack design
3. **Cross-Stack References and Drift Detection** -- Learn resource sharing between multiple stacks and detecting differences from actual configurations
4. **Custom Resources and Macros** -- Learn how to extend CloudFormation with Lambda-backed custom resources and template macros
5. **Stack Sets and Multi-Account Management** -- Understand large-scale deployments integrated with AWS Organizations
6. **CI/CD Integration and Troubleshooting** -- Integrate CloudFormation into CI/CD pipelines and develop incident response skills


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. CloudFormation Fundamentals

### 1.1 Infrastructure as Code (IaC)

```
CloudFormation workflow:

Template (YAML/JSON)
    |
    v
+------------------+
| CloudFormation   |
| Service          |
+------------------+
    |
    | Resource provisioning
    |
    v
+------------------+
| Stack            |
| +------+ +-----+|
| | VPC  | | EC2 ||
| +------+ +-----+|
| +------+ +-----+|
| | RDS  | | SG  ||
| +------+ +-----+|
+------------------+
    |
    | State tracking & change management
    v
+------------------+
| Stack Events     |
| Drift Detection  |
+------------------+
```

### 1.2 Template Structure Overview

```
Template sections:

+-------------------------------------------+
| AWSTemplateFormatVersion (version)         |
+-------------------------------------------+
| Description                                |
+-------------------------------------------+
| Metadata                                   |
+-------------------------------------------+
| Parameters (input values)                  |
+-------------------------------------------+
| Rules (parameter validation)               |
+-------------------------------------------+
| Mappings (static lookup tables)            |
+-------------------------------------------+
| Conditions (control resource creation)     |
+-------------------------------------------+
| Transform (apply macros)                   |
+-------------------------------------------+
| Resources (required section)               |
+-------------------------------------------+
| Outputs (exported values)                  |
+-------------------------------------------+
```

### 1.3 CloudFormation vs Other IaC Tools

| Property | CloudFormation | Terraform | CDK | Pulumi |
|----------|---------------|-----------|-----|--------|
| Vendor | AWS | HashiCorp | AWS | Pulumi |
| Cloud Support | AWS only | Multi-cloud | AWS only | Multi-cloud |
| Language | YAML/JSON | HCL | TypeScript/Python etc. | TypeScript/Python etc. |
| State Management | AWS managed | tfstate file | CloudFormation | Pulumi Cloud |
| Change Preview | Change sets | plan | diff | preview |
| Drift Detection | Yes | Yes | Yes (via CFn) | Yes |
| Cost | Free | Free/Paid | Free | Free/Paid |
| Learning Curve | Low to medium | Medium | Medium to high | Medium to high |
| Ecosystem | Deep AWS integration | Very broad | Deep AWS integration | Broad |

```
Selection guide:

AWS only + YAML preference             → CloudFormation
AWS only + programming language pref.  → CDK
Multi-cloud + declarative              → Terraform
Multi-cloud + programming language     → Pulumi
Existing CFn assets                    → CloudFormation or CDK
```

---

## 2. Template Syntax

### 2.1 Basic Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Web Application Infrastructure Template'

Parameters:
  EnvironmentName:
    Type: String
    Default: dev
    AllowedValues: [dev, stg, prod]
    Description: Target deployment environment name

  InstanceType:
    Type: String
    Default: t3.micro
    AllowedValues: [t3.micro, t3.small, t3.medium]
    Description: EC2 instance type

  VpcCidr:
    Type: String
    Default: '10.0.0.0/16'
    AllowedPattern: '(\d{1,3}\.){3}\d{1,3}/\d{1,2}'
    Description: VPC CIDR block

Mappings:
  RegionAMI:
    ap-northeast-1:
      HVM64: ami-0abcdef1234567890
    us-east-1:
      HVM64: ami-0fedcba9876543210

Conditions:
  IsProduction: !Equals [!Ref EnvironmentName, prod]
  CreateReadReplica: !Equals [!Ref EnvironmentName, prod]

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-vpc'

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [0, !Cidr [!Ref VpcCidr, 4, 8]]
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-public-1'

  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !If [IsProduction, t3.medium, !Ref InstanceType]
      ImageId: !FindInMap [RegionAMI, !Ref 'AWS::Region', HVM64]
      SubnetId: !Ref PublicSubnet1
      SecurityGroupIds:
        - !Ref WebSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-web-server'

  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Web server security group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0

Outputs:
  VpcId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub '${EnvironmentName}-VpcId'

  WebServerPublicIP:
    Description: Web server public IP address
    Value: !GetAtt WebServer.PublicIp
```

### 2.2 Key Intrinsic Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `!Ref` | Reference a parameter or resource | `!Ref VPC` |
| `!Sub` | Variable substitution in strings | `!Sub '${Env}-vpc'` |
| `!GetAtt` | Get a resource attribute | `!GetAtt EC2.PublicIp` |
| `!Join` | Concatenate strings | `!Join ['-', [a, b, c]]` |
| `!Select` | Select an element from a list | `!Select [0, !GetAZs '']` |
| `!Split` | Split a string | `!Split [',', 'a,b,c']` |
| `!If` | Conditional branching | `!If [IsProd, t3.large, t3.micro]` |
| `!FindInMap` | Look up a mapping value | `!FindInMap [Map, Key1, Key2]` |
| `!ImportValue` | Reference output from another stack | `!ImportValue 'vpc-id'` |
| `!Cidr` | Split CIDR block | `!Cidr [!Ref VpcCidr, 4, 8]` |
| `!GetAZs` | Get list of AZs | `!GetAZs ''` |
| `!Base64` | Base64 encode | `!Base64 !Sub 'script'` |
| `!Transform` | Apply a macro | `!Transform {Name: macro}` |

### 2.3 Intrinsic Function Usage Examples

```yaml
# Advanced usage of !Sub
BucketPolicy:
  Type: AWS::S3::BucketPolicy
  Properties:
    Bucket: !Ref MyBucket
    PolicyDocument:
      Statement:
        - Effect: Allow
          Principal:
            AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:role/${RoleName}'
          Action: 's3:GetObject'
          Resource: !Sub 'arn:aws:s3:::${MyBucket}/*'

# Automatic subnet calculation with !Cidr
Subnets:
  # Automatically calculate 4 /24 subnets from 10.0.0.0/16
  # → 10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24, 10.0.3.0/24
  - !Select [0, !Cidr [!Ref VpcCidr, 4, 8]]
  - !Select [1, !Cidr [!Ref VpcCidr, 4, 8]]
  - !Select [2, !Cidr [!Ref VpcCidr, 4, 8]]
  - !Select [3, !Cidr [!Ref VpcCidr, 4, 8]]
```

### 2.4 Advanced Parameter Configuration

```yaml
Parameters:
  # Dynamic reference from SSM Parameter Store
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2
    Description: Latest Amazon Linux 2 AMI ID

  # Regex-based validation
  ProjectName:
    Type: String
    MinLength: 3
    MaxLength: 20
    AllowedPattern: '[a-z][a-z0-9-]*'
    ConstraintDescription: Lowercase alphanumeric and hyphens only. Must start with a letter.

  # Multi-select parameter
  SubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
    Description: Target deployment subnets

  # Hide password with NoEcho
  DatabasePassword:
    Type: String
    NoEcho: true
    MinLength: 8
    MaxLength: 128
    AllowedPattern: '[a-zA-Z0-9!@#$%^&*()_+-=]*'
    Description: RDS master password

  # Dynamic reference from Secrets Manager
  DatabaseCredentials:
    Type: String
    Default: '{{resolve:secretsmanager:prod/db/credentials:SecretString:password}}'
```

### 2.5 Rules Section (Parameter Validation)

```yaml
Rules:
  # Prohibit t3.micro in production
  ProdInstanceTypeRule:
    RuleCondition: !Equals [!Ref EnvironmentName, prod]
    Assertions:
      - Assert: !Not [!Equals [!Ref InstanceType, t3.micro]]
        AssertDescription: t3.micro cannot be used in the production environment

  # Multi-AZ is required only in production
  MultiAZRule:
    RuleCondition: !Equals [!Ref EnvironmentName, prod]
    Assertions:
      - Assert: !Equals [!Ref MultiAZDatabase, true]
        AssertDescription: Please enable Multi-AZ in the production environment
```

### 2.6 Metadata Section

```yaml
Metadata:
  # Parameter grouping in the console
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: Network Configuration
        Parameters:
          - VpcCidr
          - SubnetIds
      - Label:
          default: Compute Configuration
        Parameters:
          - InstanceType
          - KeyPairName
      - Label:
          default: Database Configuration
        Parameters:
          - DatabasePassword
          - MultiAZDatabase
    ParameterLabels:
      VpcCidr:
        default: VPC CIDR Block
      InstanceType:
        default: EC2 Instance Type
```

---

## 3. Stack Management

### 3.1 Stack CRUD Operations

```bash
# Create a stack
aws cloudformation create-stack \
  --stack-name my-web-stack \
  --template-body file://template.yaml \
  --parameters \
    ParameterKey=EnvironmentName,ParameterValue=prod \
    ParameterKey=InstanceType,ParameterValue=t3.small \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags Key=Project,Value=MyApp

# Create a change set (preview before updating)
aws cloudformation create-change-set \
  --stack-name my-web-stack \
  --change-set-name update-instance-type \
  --template-body file://template-v2.yaml \
  --parameters \
    ParameterKey=InstanceType,ParameterValue=t3.medium

# Describe a change set
aws cloudformation describe-change-set \
  --stack-name my-web-stack \
  --change-set-name update-instance-type

# Execute a change set
aws cloudformation execute-change-set \
  --stack-name my-web-stack \
  --change-set-name update-instance-type

# Delete a stack
aws cloudformation delete-stack \
  --stack-name my-web-stack

# Wait for stack creation to complete
aws cloudformation wait stack-create-complete \
  --stack-name my-web-stack

# Check stack events
aws cloudformation describe-stack-events \
  --stack-name my-web-stack \
  --query 'StackEvents[0:10].{Time:Timestamp,Status:ResourceStatus,Type:ResourceType,Reason:ResourceStatusReason}' \
  --output table
```

### 3.2 Resource Impact Levels During Stack Updates

```
Update impact levels:

No Interruption:
  Tag changes, adding security group rules
  → No service impact

Some Interruption:
  EC2 instance type change
  → Temporary service downtime

Replacement:
  RDS engine change, EC2 AMI change
  → Creates new resource and deletes old resource
  ⚠ Potential data loss!

Always verify impact in advance using change sets
```

### 3.3 Stack Policies

```json
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "Update:*",
      "Principal": "*",
      "Resource": "*"
    },
    {
      "Effect": "Deny",
      "Action": "Update:Replace",
      "Principal": "*",
      "Resource": "LogicalResourceId/Database",
      "Condition": {
        "StringEquals": {
          "ResourceType": ["AWS::RDS::DBInstance"]
        }
      }
    }
  ]
}
```

```bash
# Set a stack policy
aws cloudformation set-stack-policy \
  --stack-name my-web-stack \
  --stack-policy-body file://stack-policy.json

# Get a stack policy
aws cloudformation get-stack-policy \
  --stack-name my-web-stack
```

### 3.4 Rollback Configuration

```bash
# Create a stack with rollback configuration
aws cloudformation create-stack \
  --stack-name my-web-stack \
  --template-body file://template.yaml \
  --rollback-configuration \
    RollbackTriggers='[{Arn=arn:aws:cloudwatch:ap-northeast-1:123456789012:alarm:HighErrorRate,Type=AWS::CloudWatch::Alarm}]',\
    MonitoringTimeInMinutes=10

# Disable rollback (for debugging)
aws cloudformation update-stack \
  --stack-name my-web-stack \
  --template-body file://template-v2.yaml \
  --disable-rollback
```

### 3.5 Stack Import

```bash
# Import existing resources into a stack
# 1. Prepare an import template (DeletionPolicy: Retain is required)
# 2. Create a change set
aws cloudformation create-change-set \
  --stack-name my-web-stack \
  --change-set-name import-existing-resources \
  --change-set-type IMPORT \
  --template-body file://import-template.yaml \
  --resources-to-import '[
    {
      "ResourceType": "AWS::EC2::SecurityGroup",
      "LogicalResourceId": "WebSecurityGroup",
      "ResourceIdentifier": {"GroupId": "sg-12345678"}
    }
  ]'

# Describe and execute the change set
aws cloudformation describe-change-set \
  --stack-name my-web-stack \
  --change-set-name import-existing-resources

aws cloudformation execute-change-set \
  --stack-name my-web-stack \
  --change-set-name import-existing-resources
```

```yaml
# Import template (DeletionPolicy: Retain is required)
Resources:
  WebSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    DeletionPolicy: Retain
    Properties:
      GroupDescription: Imported security group
      VpcId: vpc-12345678
```

---

## 4. Cross-Stack References

### 4.1 Export/Import Pattern

```
Cross-stack references:

Network Stack                       Application Stack
+------------------+            +------------------+
| VPC              |            | EC2 Instance     |
| Subnets          |  Export    | SubnetId:        |
| Security Groups  | ========> |   !ImportValue    |
|                  |  VpcId    |   'prod-VpcId'   |
| Outputs:         |  SubnetIds|                  |
|   Export:        |           | Security Group:   |
|   'prod-VpcId'   |           |   !ImportValue    |
|   'prod-SubnetIds'|          |   'prod-SG'      |
+------------------+            +------------------+
```

```yaml
# network-stack.yaml (exporting side)
Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub '${EnvironmentName}-VpcId'

  PublicSubnetIds:
    Value: !Join [',', [!Ref PublicSubnet1, !Ref PublicSubnet2]]
    Export:
      Name: !Sub '${EnvironmentName}-PublicSubnetIds'

# app-stack.yaml (importing side)
Resources:
  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      SubnetId: !Select
        - 0
        - !Split [',', !ImportValue 'prod-PublicSubnetIds']
      SecurityGroupIds:
        - !ImportValue 'prod-WebSG'
```

### 4.2 Nested Stacks

```yaml
# parent-stack.yaml
Resources:
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-bucket/network.yaml
      Parameters:
        EnvironmentName: !Ref EnvironmentName
        VpcCidr: !Ref VpcCidr

  DatabaseStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: NetworkStack
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-bucket/database.yaml
      Parameters:
        VpcId: !GetAtt NetworkStack.Outputs.VpcId
        SubnetIds: !GetAtt NetworkStack.Outputs.PrivateSubnetIds

  ApplicationStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: [NetworkStack, DatabaseStack]
    Properties:
      TemplateURL: https://s3.amazonaws.com/my-bucket/application.yaml
      Parameters:
        VpcId: !GetAtt NetworkStack.Outputs.VpcId
        DatabaseEndpoint: !GetAtt DatabaseStack.Outputs.Endpoint
```

### 4.3 Export/Import vs Nested Stacks

```
Export/Import:
  ✓ Loose coupling between stacks
  ✓ Can deploy and update independently
  ✓ Different teams can manage separately
  ✗ Impact on importing stacks when export values change
  ✗ Deletion order must be managed carefully

Nested Stacks:
  ✓ Centrally managed by the parent stack
  ✓ Explicit parameter passing
  ✓ Deploy and delete all at once
  ✗ Tight coupling
  ✗ Wide blast radius during updates
  ✗ Templates must be stored in S3

Recommended patterns:
  Between layers (Network ↔ App)  → Export/Import
  Splitting within the same layer  → Nested Stacks
```

---

## 5. Drift Detection

### 5.1 What Is Drift?

```
How drift detection works:

CloudFormation Template               Actual Resource State
+--------------------+              +--------------------+
| SG: port 80, 443   |              | SG: port 80, 443,  |
|                    |   !=          |     8080           |
|                    |              | (added manually)   |
+--------------------+              +--------------------+

Drift detection result:
  - Resource: WebSecurityGroup
  - Drift Status: MODIFIED
  - Difference: port 8080 added to SecurityGroupIngress
```

### 5.2 Running Drift Detection

```bash
# Start drift detection
aws cloudformation detect-stack-drift \
  --stack-name my-web-stack

# Check drift detection results
aws cloudformation describe-stack-drift-detection-status \
  --stack-drift-detection-id <detection-id>

# Drift details per resource
aws cloudformation describe-stack-resource-drifts \
  --stack-name my-web-stack \
  --stack-resource-drift-status-filters MODIFIED DELETED

# Detect drift for a specific resource
aws cloudformation detect-stack-resource-drift \
  --stack-name my-web-stack \
  --logical-resource-id WebSecurityGroup
```

| Drift Status | Meaning |
|--------------|---------|
| IN_SYNC | Matches the template |
| MODIFIED | Properties have been changed |
| DELETED | Resource has been deleted |
| NOT_CHECKED | Not yet checked |

### 5.3 Automating Drift Detection

```yaml
# Periodic drift check using EventBridge + Lambda
Resources:
  DriftCheckSchedule:
    Type: AWS::Events::Rule
    Properties:
      Description: Daily drift detection
      ScheduleExpression: 'cron(0 9 * * ? *)'
      State: ENABLED
      Targets:
        - Arn: !GetAtt DriftCheckFunction.Arn
          Id: DriftCheckTarget

  DriftCheckFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: python3.12
      Handler: index.handler
      Role: !GetAtt DriftCheckRole.Arn
      Code:
        ZipFile: |
          import boto3
          import json

          cfn = boto3.client('cloudformation')
          sns = boto3.client('sns')

          def handler(event, context):
              # Detect drift for all stacks
              stacks = cfn.list_stacks(
                  StackStatusFilter=['CREATE_COMPLETE', 'UPDATE_COMPLETE']
              )

              results = []
              for stack in stacks['StackSummaries']:
                  stack_name = stack['StackName']
                  try:
                      response = cfn.detect_stack_drift(
                          StackName=stack_name
                      )
                      results.append({
                          'stack': stack_name,
                          'detection_id': response['StackDriftDetectionId']
                      })
                  except Exception as e:
                      print(f"Error checking {stack_name}: {e}")

              return {'statusCode': 200, 'results': results}
```

---

## 6. Custom Resources

### 6.1 Lambda-Backed Custom Resources

```yaml
# Custom resource definition
Resources:
  # Lambda function
  CustomResourceFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub '${AWS::StackName}-custom-resource'
      Runtime: python3.12
      Handler: index.handler
      Timeout: 300
      Role: !GetAtt CustomResourceRole.Arn
      Code:
        ZipFile: |
          import json
          import urllib.request
          import boto3

          def handler(event, context):
              response_data = {}
              physical_resource_id = event.get('PhysicalResourceId', 'custom-resource')

              try:
                  if event['RequestType'] == 'Create':
                      # Resource creation logic
                      # Example: upload default file to S3 bucket
                      s3 = boto3.client('s3')
                      bucket_name = event['ResourceProperties']['BucketName']
                      s3.put_object(
                          Bucket=bucket_name,
                          Key='config/default.json',
                          Body=json.dumps({'version': '1.0'})
                      )
                      physical_resource_id = f"{bucket_name}-init"
                      response_data['Message'] = 'Created successfully'

                  elif event['RequestType'] == 'Update':
                      # Resource update logic
                      response_data['Message'] = 'Updated successfully'

                  elif event['RequestType'] == 'Delete':
                      # Resource deletion logic (cleanup)
                      s3 = boto3.client('s3')
                      bucket_name = event['ResourceProperties']['BucketName']
                      # Delete objects in the bucket
                      objects = s3.list_objects_v2(Bucket=bucket_name)
                      if 'Contents' in objects:
                          delete_objects = [{'Key': obj['Key']} for obj in objects['Contents']]
                          s3.delete_objects(
                              Bucket=bucket_name,
                              Delete={'Objects': delete_objects}
                          )
                      response_data['Message'] = 'Deleted successfully'

                  send_response(event, context, 'SUCCESS', response_data, physical_resource_id)

              except Exception as e:
                  print(f"Error: {e}")
                  send_response(event, context, 'FAILED', {'Error': str(e)}, physical_resource_id)

          def send_response(event, context, status, data, physical_resource_id):
              response_body = json.dumps({
                  'Status': status,
                  'Reason': f"See CloudWatch Log Stream: {context.log_stream_name}",
                  'PhysicalResourceId': physical_resource_id,
                  'StackId': event['StackId'],
                  'RequestId': event['RequestId'],
                  'LogicalResourceId': event['LogicalResourceId'],
                  'Data': data
              })

              req = urllib.request.Request(
                  event['ResponseURL'],
                  data=response_body.encode('utf-8'),
                  headers={'Content-Type': 'application/json'},
                  method='PUT'
              )
              urllib.request.urlopen(req)

  # Calling the custom resource
  BucketInitializer:
    Type: Custom::BucketInit
    DependsOn: MyBucket
    Properties:
      ServiceToken: !GetAtt CustomResourceFunction.Arn
      BucketName: !Ref MyBucket

  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '${AWS::StackName}-data-bucket'
```

### 6.2 cfn-response Module

```yaml
# Simple custom resource using cfn-response
CustomResourceFunction:
  Type: AWS::Lambda::Function
  Properties:
    Runtime: python3.12
    Handler: index.handler
    Role: !GetAtt CustomResourceRole.Arn
    Code:
      ZipFile: |
        import cfnresponse
        import boto3

        def handler(event, context):
            try:
                if event['RequestType'] == 'Create':
                    # Processing
                    response_data = {'Result': 'Success'}
                    cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data)
                elif event['RequestType'] == 'Delete':
                    cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
                else:
                    cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
            except Exception as e:
                cfnresponse.send(event, context, cfnresponse.FAILED, {'Error': str(e)})
```

### 6.3 AWS::CloudFormation::CustomResource vs Custom::*

```
Custom::BucketInit (recommended):
  - Type name makes the resource purpose clear
  - Easier to distinguish multiple custom resources
  - More readable in the CloudFormation console

AWS::CloudFormation::CustomResource:
  - Official resource type name
  - Functionally identical to Custom::
  - Slightly more verbose
```

---

## 7. CloudFormation Macros

### 7.1 How Macros Work

```
Macro processing flow:

Template → CloudFormation → Macro (Lambda) → Transformed Template → Resource creation
                |                                     ↑
                | Transform section                   |
                +-------------------------------------+

Built-in macros:
  AWS::Include     → Include external template fragments
  AWS::Serverless  → Transform SAM templates
```

```yaml
# Using the AWS::Include macro
Resources:
  MyResource:
    Fn::Transform:
      Name: AWS::Include
      Parameters:
        Location: s3://my-bucket/resource-snippet.yaml

# SAM template (AWS::Serverless macro)
Transform: AWS::Serverless-2016-10-31

Resources:
  MyFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: python3.12
      Handler: app.handler
      Events:
        Api:
          Type: Api
          Properties:
            Path: /hello
            Method: get
```

### 7.2 Creating Custom Macros

```yaml
# Macro registration template
Resources:
  MacroFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: EnvVarInjector
      Runtime: python3.12
      Handler: index.handler
      Role: !GetAtt MacroRole.Arn
      Code:
        ZipFile: |
          import copy

          def handler(event, context):
              """Macro that automatically injects common environment variables into all Lambda functions"""
              fragment = event['fragment']
              common_env = event['templateParameterValues'].get('CommonEnvVars', {})

              for resource_name, resource in fragment.get('Resources', {}).items():
                  if resource['Type'] == 'AWS::Lambda::Function':
                      props = resource.get('Properties', {})
                      env = props.get('Environment', {})
                      variables = env.get('Variables', {})
                      variables.update({
                          'ENVIRONMENT': fragment.get('Parameters', {}).get('EnvironmentName', {}).get('Default', 'dev'),
                          'REGION': {'Ref': 'AWS::Region'},
                          'STACK_NAME': {'Ref': 'AWS::StackName'}
                      })
                      env['Variables'] = variables
                      props['Environment'] = env
                      resource['Properties'] = props

              return {
                  'requestId': event['requestId'],
                  'status': 'success',
                  'fragment': fragment
              }

  EnvVarInjectorMacro:
    Type: AWS::CloudFormation::Macro
    Properties:
      Name: EnvVarInjector
      FunctionName: !GetAtt MacroFunction.Arn
```

```yaml
# Using the macro
Transform: EnvVarInjector

Resources:
  MyFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: python3.12
      Handler: index.handler
      # Environment is automatically injected
```

---

## 8. Stack Sets (Multi-Account and Multi-Region)

### 8.1 Stack Set Concepts

```
Stack Sets:

Management Account
+---------------------+
| StackSet            |
| (template definition)|
+---------------------+
        |
        | Deploy
        |
        +--→ Account A / ap-northeast-1  → Stack Instance
        |
        +--→ Account A / us-east-1       → Stack Instance
        |
        +--→ Account B / ap-northeast-1  → Stack Instance
        |
        +--→ Account B / us-east-1       → Stack Instance

Deployment models:
  Self-managed: Manually configure IAM roles
  Service-managed: Automatically integrated with AWS Organizations
```

### 8.2 Creating and Managing Stack Sets

```bash
# Create a stack set (Service-managed)
aws cloudformation create-stack-set \
  --stack-set-name security-baseline \
  --template-body file://security-baseline.yaml \
  --permission-model SERVICE_MANAGED \
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=false \
  --capabilities CAPABILITY_NAMED_IAM

# Deploy stack instances (specifying an OU)
aws cloudformation create-stack-instances \
  --stack-set-name security-baseline \
  --deployment-targets OrganizationalUnitIds='["ou-xxxx-yyyyyyy"]' \
  --regions ap-northeast-1 us-east-1 \
  --operation-preferences \
    FailureTolerancePercentage=10,\
    MaxConcurrentPercentage=25,\
    RegionConcurrencyType=PARALLEL

# Update a stack set
aws cloudformation update-stack-set \
  --stack-set-name security-baseline \
  --template-body file://security-baseline-v2.yaml

# Check stack instance status
aws cloudformation list-stack-instances \
  --stack-set-name security-baseline \
  --query 'Summaries[].{Account:Account,Region:Region,Status:Status}' \
  --output table
```

### 8.3 Security Baseline Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Security Baseline (common to all accounts)'

Resources:
  # Enable CloudTrail
  CloudTrail:
    Type: AWS::CloudTrail::Trail
    Properties:
      TrailName: organization-trail
      IsLogging: true
      IsMultiRegionTrail: true
      EnableLogFileValidation: true
      S3BucketName: !Sub 'cloudtrail-${AWS::AccountId}'

  # Enable GuardDuty
  GuardDutyDetector:
    Type: AWS::GuardDuty::Detector
    Properties:
      Enable: true
      DataSources:
        S3Logs:
          Enable: true
        Kubernetes:
          AuditLogs:
            Enable: true

  # Enable Config
  ConfigRecorder:
    Type: AWS::Config::ConfigurationRecorder
    Properties:
      Name: default
      RoleARN: !GetAtt ConfigRole.Arn
      RecordingGroup:
        AllSupported: true
        IncludeGlobalResourceTypes: true

  # Config rule to prevent default VPC deletion
  RestrictedSSH:
    Type: AWS::Config::ConfigRule
    DependsOn: ConfigRecorder
    Properties:
      ConfigRuleName: restricted-ssh
      Source:
        Owner: AWS
        SourceIdentifier: INCOMING_SSH_DISABLED

  # Password policy
  PasswordPolicy:
    Type: Custom::PasswordPolicy
    Properties:
      ServiceToken: !GetAtt PasswordPolicyFunction.Arn
      MinimumPasswordLength: 14
      RequireSymbols: true
      RequireNumbers: true
      RequireUppercaseCharacters: true
      RequireLowercaseCharacters: true
      MaxPasswordAge: 90
      PasswordReusePrevention: 12

  # S3 public access block (account level)
  S3PublicAccessBlock:
    Type: AWS::S3::AccountPublicAccessBlock
    Properties:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true
```

---

## 9. CI/CD Integration

### 9.1 CodePipeline + CloudFormation

```yaml
# CI/CD pipeline template
Resources:
  Pipeline:
    Type: AWS::CodePipeline::Pipeline
    Properties:
      Name: infra-pipeline
      RoleArn: !GetAtt PipelineRole.Arn
      ArtifactStore:
        Type: S3
        Location: !Ref ArtifactBucket
      Stages:
        # Source stage
        - Name: Source
          Actions:
            - Name: SourceAction
              ActionTypeId:
                Category: Source
                Owner: AWS
                Provider: CodeStarSourceConnection
                Version: "1"
              Configuration:
                ConnectionArn: !Ref CodeStarConnection
                FullRepositoryId: my-org/infra-repo
                BranchName: main
              OutputArtifacts:
                - Name: SourceOutput

        # Test stage
        - Name: Test
          Actions:
            - Name: CFnLint
              ActionTypeId:
                Category: Build
                Owner: AWS
                Provider: CodeBuild
                Version: "1"
              Configuration:
                ProjectName: !Ref LintProject
              InputArtifacts:
                - Name: SourceOutput

        # Staging environment
        - Name: Staging
          Actions:
            - Name: CreateChangeSet
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: CloudFormation
                Version: "1"
              Configuration:
                ActionMode: CHANGE_SET_REPLACE
                StackName: staging-stack
                ChangeSetName: staging-changeset
                TemplatePath: SourceOutput::template.yaml
                TemplateConfiguration: SourceOutput::config/staging.json
                Capabilities: CAPABILITY_NAMED_IAM
                RoleArn: !GetAtt CloudFormationRole.Arn
              InputArtifacts:
                - Name: SourceOutput
              RunOrder: 1

            - Name: ExecuteChangeSet
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: CloudFormation
                Version: "1"
              Configuration:
                ActionMode: CHANGE_SET_EXECUTE
                StackName: staging-stack
                ChangeSetName: staging-changeset
              RunOrder: 2

        # Approval stage
        - Name: Approval
          Actions:
            - Name: ManualApproval
              ActionTypeId:
                Category: Approval
                Owner: AWS
                Provider: Manual
                Version: "1"
              Configuration:
                NotificationArn: !Ref ApprovalTopic
                CustomData: "Please approve the deployment to the production environment"

        # Production environment
        - Name: Production
          Actions:
            - Name: CreateChangeSet
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: CloudFormation
                Version: "1"
              Configuration:
                ActionMode: CHANGE_SET_REPLACE
                StackName: production-stack
                ChangeSetName: production-changeset
                TemplatePath: SourceOutput::template.yaml
                TemplateConfiguration: SourceOutput::config/production.json
                Capabilities: CAPABILITY_NAMED_IAM
                RoleArn: !GetAtt CloudFormationRole.Arn
              InputArtifacts:
                - Name: SourceOutput
              RunOrder: 1

            - Name: ExecuteChangeSet
              ActionTypeId:
                Category: Deploy
                Owner: AWS
                Provider: CloudFormation
                Version: "1"
              Configuration:
                ActionMode: CHANGE_SET_EXECUTE
                StackName: production-stack
                ChangeSetName: production-changeset
              RunOrder: 2
```

### 9.2 GitHub Actions + CloudFormation

```yaml
# .github/workflows/deploy.yml
name: Deploy Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'cloudformation/**'
  pull_request:
    branches: [main]
    paths:
      - 'cloudformation/**'

permissions:
  id-token: write
  contents: read
  pull-requests: write

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: cfn-lint
        uses: scottbrenner/cfn-lint-action@v2
        with:
          command: cfn-lint cloudformation/**/*.yaml

      - name: cfn-nag
        uses: stelligent/cfn_nag@master
        with:
          input_path: cloudformation/

  deploy-staging:
    needs: lint
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-role
          aws-region: ap-northeast-1

      - name: Deploy to Staging
        run: |
          aws cloudformation deploy \
            --template-file cloudformation/template.yaml \
            --stack-name staging-stack \
            --parameter-overrides \
              EnvironmentName=stg \
              InstanceType=t3.small \
            --capabilities CAPABILITY_NAMED_IAM \
            --no-fail-on-empty-changeset

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-role
          aws-region: ap-northeast-1

      - name: Create Change Set
        run: |
          aws cloudformation create-change-set \
            --stack-name production-stack \
            --change-set-name "deploy-${GITHUB_SHA}" \
            --template-body file://cloudformation/template.yaml \
            --parameters \
              ParameterKey=EnvironmentName,ParameterValue=prod \
            --capabilities CAPABILITY_NAMED_IAM

          aws cloudformation wait change-set-create-complete \
            --stack-name production-stack \
            --change-set-name "deploy-${GITHUB_SHA}"

      - name: Describe Change Set
        run: |
          aws cloudformation describe-change-set \
            --stack-name production-stack \
            --change-set-name "deploy-${GITHUB_SHA}" \
            --output json

      - name: Execute Change Set
        run: |
          aws cloudformation execute-change-set \
            --stack-name production-stack \
            --change-set-name "deploy-${GITHUB_SHA}"

          aws cloudformation wait stack-update-complete \
            --stack-name production-stack
```

### 9.3 Template Linting and Testing

```bash
# cfn-lint (syntax check)
pip install cfn-lint
cfn-lint template.yaml

# cfn-nag (security check)
gem install cfn-nag
cfn_nag_scan --input-path template.yaml

# TaskCat (multi-region testing)
pip install taskcat
taskcat test run

# Rain (CloudFormation utility tool)
# Format a template
rain fmt template.yaml

# Deploy a template (interactive)
rain deploy template.yaml my-stack

# Show stack information
rain ls
rain watch my-stack
```

```yaml
# TaskCat configuration file (.taskcat.yml)
project:
  name: my-infra
  regions:
    - ap-northeast-1
    - us-east-1
tests:
  default:
    template: template.yaml
    parameters:
      EnvironmentName: test
      InstanceType: t3.micro
```

---

## 10. Troubleshooting

### 10.1 Common Errors and Solutions

```
Error 1: CREATE_FAILED - Resource already exists
Cause: A resource with the same name already exists
Solution:
  - Change the resource name
  - Import the existing resource
  - Delete the existing resource before creating the stack

Error 2: UPDATE_ROLLBACK_FAILED
Cause: An error occurred during rollback
Solution:
  - Run ContinueUpdateRollback
  aws cloudformation continue-update-rollback \
    --stack-name my-stack \
    --resources-to-skip LogicalResourceId1

Error 3: DELETE_FAILED
Cause: Resource is referenced elsewhere / was manually modified
Solution:
  - Delete dependent resources first
  - Force delete with the retain-resources option
  aws cloudformation delete-stack \
    --stack-name my-stack \
    --retain-resources WebSecurityGroup

Error 4: Template validation error
Cause: Template syntax error
Solution:
  - Validate in advance with aws cloudformation validate-template
  aws cloudformation validate-template \
    --template-body file://template.yaml

Error 5: InsufficientCapabilities
Cause: Missing capabilities for creating IAM resources
Solution:
  - Add --capabilities CAPABILITY_NAMED_IAM
  - CAPABILITY_AUTO_EXPAND (when using macros)
```

### 10.2 Handling UPDATE_ROLLBACK_FAILED

```bash
# 1. Identify the failed resource
aws cloudformation describe-stack-events \
  --stack-name my-stack \
  --query 'StackEvents[?ResourceStatus==`UPDATE_FAILED`].{Resource:LogicalResourceId,Reason:ResourceStatusReason}' \
  --output table

# 2. Skip the problematic resource and continue the rollback
aws cloudformation continue-update-rollback \
  --stack-name my-stack \
  --resources-to-skip MyLambdaFunction MySecurityGroup

# 3. Wait for rollback to complete
aws cloudformation wait stack-rollback-complete \
  --stack-name my-stack
```

### 10.3 Stuck Stack Deletion

```bash
# Remove termination protection
aws cloudformation update-termination-protection \
  --no-enable-termination-protection \
  --stack-name my-stack

# Check dependencies
aws cloudformation list-imports \
  --export-name 'my-stack-VpcId'

# Handle non-empty S3 bucket
aws s3 rm s3://my-bucket --recursive
aws cloudformation delete-stack --stack-name my-stack

# Force delete (retain some resources)
aws cloudformation delete-stack \
  --stack-name my-stack \
  --retain-resources SecurityGroup VPCEndpoint
```

### 10.4 Debugging Techniques

```yaml
# EC2 initialization and signaling with cfn-init and cfn-signal

Resources:
  WebServer:
    Type: AWS::EC2::Instance
    CreationPolicy:
      ResourceSignal:
        Count: 1
        Timeout: PT15M  # Timeout after 15 minutes
    Metadata:
      AWS::CloudFormation::Init:
        configSets:
          full_install:
            - install_packages
            - configure_app
        install_packages:
          packages:
            yum:
              httpd: []
              php: []
          services:
            sysvinit:
              httpd:
                enabled: true
                ensureRunning: true
        configure_app:
          files:
            /var/www/html/index.html:
              content: |
                <html><body>Hello from CloudFormation!</body></html>
              mode: '000644'
    Properties:
      ImageId: !Ref LatestAmiId
      InstanceType: !Ref InstanceType
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash -xe
          yum update -y
          yum install -y aws-cfn-bootstrap

          # Run cfn-init
          /opt/aws/bin/cfn-init -v \
            --stack ${AWS::StackName} \
            --resource WebServer \
            --configsets full_install \
            --region ${AWS::Region}

          # Report result with cfn-signal
          /opt/aws/bin/cfn-signal -e $? \
            --stack ${AWS::StackName} \
            --resource WebServer \
            --region ${AWS::Region}
```

---

## 11. Advanced Template Patterns

### 11.1 DeletionPolicy and UpdateReplacePolicy

```yaml
Resources:
  # Delete after taking a snapshot
  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    UpdateReplacePolicy: Snapshot
    Properties:
      DBInstanceClass: db.t3.medium
      Engine: mysql
      MasterUsername: admin
      MasterUserPassword: !Ref DatabasePassword

  # Retain (keep the resource even when the stack is deleted)
  ImportantBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Retain
    Properties:
      BucketName: !Sub '${AWS::StackName}-important-data'

  # Normal deletion (default)
  TempBucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Delete
    Properties:
      BucketName: !Sub '${AWS::StackName}-temp'
```

### 11.2 DependsOn and WaitCondition

```yaml
Resources:
  # Explicit dependency
  ApplicationServer:
    Type: AWS::EC2::Instance
    DependsOn:
      - Database
      - CacheCluster
    Properties:
      # ...

  # WaitCondition (wait for signal from external process)
  WaitHandle:
    Type: AWS::CloudFormation::WaitConditionHandle

  WaitCondition:
    Type: AWS::CloudFormation::WaitCondition
    DependsOn: ApplicationServer
    Properties:
      Handle: !Ref WaitHandle
      Timeout: '600'
      Count: 1
```

### 11.3 Using Conditions

```yaml
Conditions:
  IsProduction: !Equals [!Ref EnvironmentName, prod]
  IsNotProduction: !Not [!Equals [!Ref EnvironmentName, prod]]
  CreateReplica: !And
    - !Equals [!Ref EnvironmentName, prod]
    - !Equals [!Ref EnableReadReplica, true]
  UseCustomDomain: !Not [!Equals [!Ref DomainName, '']]

Resources:
  # Conditional resource creation
  ReadReplica:
    Type: AWS::RDS::DBInstance
    Condition: CreateReplica
    Properties:
      SourceDBInstanceIdentifier: !Ref Database
      DBInstanceClass: db.t3.medium

  # Conditional property
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Scheme: !If [IsProduction, internet-facing, internal]
      Subnets: !If
        - IsProduction
        - [!Ref PublicSubnet1, !Ref PublicSubnet2, !Ref PublicSubnet3]
        - [!Ref PublicSubnet1, !Ref PublicSubnet2]

  # Conditional output
  Outputs:
    ReplicaEndpoint:
      Condition: CreateReplica
      Value: !GetAtt ReadReplica.Endpoint.Address
```

### 11.4 Dynamic References

```yaml
Resources:
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceClass: db.t3.medium
      Engine: mysql
      # Reference from SSM Parameter Store
      MasterUsername: '{{resolve:ssm:/prod/db/username}}'
      # Reference from Secrets Manager
      MasterUserPassword: '{{resolve:secretsmanager:prod/db/credentials:SecretString:password}}'

  # Reference from SSM SecureString
  ApiServer:
    Type: AWS::ECS::TaskDefinition
    Properties:
      ContainerDefinitions:
        - Name: app
          Environment:
            - Name: API_KEY
              Value: '{{resolve:ssm-secure:/prod/api/key}}'
```

---

## 12. Production-Grade Template Examples

### 12.1 3-Tier Web Application

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: '3-Tier Web Application Infrastructure'

Parameters:
  EnvironmentName:
    Type: String
    Default: prod
    AllowedValues: [dev, stg, prod]

  VpcCidr:
    Type: String
    Default: '10.0.0.0/16'

  DatabasePassword:
    Type: String
    NoEcho: true
    MinLength: 8

Conditions:
  IsProduction: !Equals [!Ref EnvironmentName, prod]

Resources:
  # ============ VPC ============
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref VpcCidr
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-vpc'

  InternetGateway:
    Type: AWS::EC2::InternetGateway

  InternetGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      InternetGatewayId: !Ref InternetGateway
      VpcId: !Ref VPC

  # Public subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [0, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-public-1'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [1, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-public-2'

  # Private subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [2, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-private-1'

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: !Select [3, !Cidr [!Ref VpcCidr, 6, 8]]
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub '${EnvironmentName}-private-2'

  # NAT Gateway
  NatGateway1EIP:
    Type: AWS::EC2::EIP
    DependsOn: InternetGatewayAttachment
    Properties:
      Domain: vpc

  NatGateway1:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGateway1EIP.AllocationId
      SubnetId: !Ref PublicSubnet1

  # Route tables
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: InternetGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  PrivateRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC

  PrivateRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway1

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet1
      RouteTableId: !Ref PrivateRouteTable

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet2
      RouteTableId: !Ref PrivateRouteTable

  # ============ ALB ============
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: ALB Security Group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0

  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub '${EnvironmentName}-alb'
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Tags:
        - Key: Environment
          Value: !Ref EnvironmentName

  ALBTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub '${EnvironmentName}-tg'
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VPC
      TargetType: ip
      HealthCheckPath: /healthz
      HealthCheckIntervalSeconds: 30
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ALBTargetGroup

  # ============ RDS ============
  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Database Security Group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3306
          ToPort: 3306
          SourceSecurityGroupId: !Ref AppSecurityGroup

  DatabaseSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Database subnet group
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2

  Database:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    UpdateReplacePolicy: Snapshot
    Properties:
      DBInstanceIdentifier: !Sub '${EnvironmentName}-db'
      DBInstanceClass: !If [IsProduction, db.r6g.large, db.t3.medium]
      Engine: mysql
      EngineVersion: '8.0'
      MasterUsername: admin
      MasterUserPassword: !Ref DatabasePassword
      AllocatedStorage: 100
      StorageType: gp3
      MultiAZ: !If [IsProduction, true, false]
      DBSubnetGroupName: !Ref DatabaseSubnetGroup
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      BackupRetentionPeriod: !If [IsProduction, 30, 7]
      StorageEncrypted: true
      DeletionProtection: !If [IsProduction, true, false]

  # ============ ECS ============
  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Application Security Group
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 8080
          ToPort: 8080
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub '${EnvironmentName}-cluster'
      ClusterSettings:
        - Name: containerInsights
          Value: enabled

  TaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  TaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub '${EnvironmentName}-app'
      NetworkMode: awsvpc
      RequiresCompatibilities: [FARGATE]
      Cpu: '512'
      Memory: '1024'
      ExecutionRoleArn: !GetAtt TaskExecutionRole.Arn
      ContainerDefinitions:
        - Name: app
          Image: !Sub '${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/my-app:latest'
          PortMappings:
            - ContainerPort: 8080
          Environment:
            - Name: DB_HOST
              Value: !GetAtt Database.Endpoint.Address
            - Name: ENVIRONMENT
              Value: !Ref EnvironmentName
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Ref LogGroup
              awslogs-region: !Ref 'AWS::Region'
              awslogs-stream-prefix: app

  Service:
    Type: AWS::ECS::Service
    DependsOn: ALBListener
    Properties:
      ServiceName: !Sub '${EnvironmentName}-app-svc'
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref TaskDefinition
      DesiredCount: !If [IsProduction, 3, 1]
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
          SecurityGroups:
            - !Ref AppSecurityGroup
      LoadBalancers:
        - ContainerName: app
          ContainerPort: 8080
          TargetGroupArn: !Ref ALBTargetGroup

  LogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/ecs/${EnvironmentName}-app'
      RetentionInDays: !If [IsProduction, 90, 14]

Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub '${EnvironmentName}-VpcId'

  ALBDnsName:
    Value: !GetAtt ApplicationLoadBalancer.DNSName

  DatabaseEndpoint:
    Value: !GetAtt Database.Endpoint.Address

  ECSClusterName:
    Value: !Ref ECSCluster
    Export:
      Name: !Sub '${EnvironmentName}-ECSCluster'
```

---

## 13. Anti-Patterns

### 13.1 One Massive Template

```
[Bad example]
Define all resources in a single template (VPC, EC2, RDS, Lambda, IAM...)
→ Template exceeds 500 lines
→ High risk during updates, difficult team collaboration

[Good example]
Split stacks by layer:
  network-stack.yaml    → VPC, Subnet, NAT GW
  security-stack.yaml   → IAM, SG, KMS
  database-stack.yaml   → RDS, ElastiCache
  app-stack.yaml        → EC2, ECS, Lambda
  monitoring-stack.yaml → CloudWatch, SNS

Stacks communicate via Export/Import
```

### 13.2 Running Databases Without DeletionPolicy

**Problem**: The database is deleted along with the stack, causing data loss.

**Fix**: Set `DeletionPolicy: Snapshot` or `DeletionPolicy: Retain` on stateful resources such as RDS and DynamoDB.

```yaml
Database:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot
  UpdateReplacePolicy: Snapshot
  Properties:
    # ...
```

### 13.3 Hardcoded Values

```yaml
# [Bad example]
Resources:
  Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0abcdef1234567890  # hardcoded
      SubnetId: subnet-12345678       # hardcoded
      SecurityGroupIds:
        - sg-87654321                 # hardcoded

# [Good example]
Parameters:
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2

Resources:
  Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref LatestAmiId
      SubnetId: !ImportValue 'network-PublicSubnet1Id'
      SecurityGroupIds:
        - !ImportValue 'security-WebSGId'
```

### 13.4 Direct Updates Without Change Sets

```
[Bad example]
aws cloudformation update-stack --stack-name prod-stack ...
→ Risk of unintended Replacement occurring

[Good example]
1. aws cloudformation create-change-set ...
2. aws cloudformation describe-change-set ...  ← Verify impact
3. aws cloudformation execute-change-set ...
```

### 13.5 Production Stacks Without Termination Protection

```bash
# Always enable termination protection for production stacks
aws cloudformation update-termination-protection \
  --enable-termination-protection \
  --stack-name production-stack
```

---

## 14. FAQ

### Q1. Should I use CloudFormation or Terraform?

If you only use AWS, CloudFormation offers deep AWS service integration and rich operational features such as change sets and drift detection. If you also manage multi-cloud or on-premises resources, Terraform is more appropriate. Your organization's existing skill set is also an important factor.

### Q2. What is the maximum template size?

The template body limit is 51,200 bytes (approximately 50 KB). When referencing a template stored in S3, this expands to 460,800 bytes (approximately 450 KB). For large configurations, consider splitting into nested stacks or using CDK.

### Q3. What happens when a stack update fails?

By default, automatic rollback is executed, reverting to the state before the update. Using the `--disable-rollback` option disables rollback, making it easier to investigate the cause of failure, but the stack remains in the UPDATE_FAILED state. In production environments, automatic rollback should always be enabled.

### Q4. What if there are resources that CloudFormation cannot manage?

Using custom resources (Lambda-backed), you can manage resources that CloudFormation does not directly support. For example, they can be used for third-party API configuration or creating resources for new AWS services before CloudFormation support is available. You can also register third-party resource types in the AWS CloudFormation Registry.

### Q5. What is the relationship between CDK and CloudFormation?

CDK is written in programming languages such as TypeScript or Python and ultimately generates and deploys CloudFormation templates. Since CloudFormation runs under the hood of CDK, knowledge of CloudFormation is essential even when using CDK. CDK is more appropriate for complex logic and reusability requirements, while using CloudFormation directly is more efficient for simple templates.

### Q6. Is there a limit on the number of stacks?

By default, the limit is 2,000 stacks per region. You can submit a raise request via Service Quotas. Export values have a limit of 5,000 per region, which cannot be raised, so for large-scale configurations consider using SSM Parameter Store as an alternative.

### Q7. How can I speed up CloudFormation deployments?

The basics are splitting templates, parallel resource creation (minimizing DependsOn), and excluding unnecessary resources. The `aws cloudformation deploy` command also automates change set creation and execution, making it suitable for use in scripts. In CI/CD pipelines, caching staging environment test results to reduce production deployment time is also an effective strategy.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is most important. Understanding deepens not just from theory, but by actually writing code and verifying behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Points |
|------|-----------|
| Templates | Declaratively define resources in YAML/JSON |
| Parameters | Externalize environment-specific settings; dynamic references from SSM/Secrets Manager also available |
| Intrinsic Functions | Compose dynamic values using !Ref, !Sub, !GetAtt, !If, etc. |
| Change Sets | Preview the scope of impact before updates (mandatory process for production updates) |
| Cross-Stack References | Share values between stacks via Export/Import |
| Nested Stacks | Split and reuse large templates |
| Drift Detection | Detect differences between template and actual configuration; can be automated |
| Custom Resources | Extend CloudFormation with Lambda |
| Stack Sets | Multi-account and multi-region deployments |
| CI/CD Integration | Automated deployments with CodePipeline / GitHub Actions |
| Troubleshooting | Rollback handling, resource import, debugging techniques |

---

## What to Read Next

- [AWS CDK](./01-cdk.md) -- Define infrastructure using programming languages
- [CodePipeline](./02-codepipeline.md) -- Integrate CloudFormation into CI/CD
- [IAM Deep Dive](../08-security/00-iam-deep-dive.md) -- IAM design for use with CloudFormation
- [ECS Basics](../06-containers/00-ecs-basics.md) -- Build ECS with CloudFormation

---

## References

1. AWS Official Documentation "AWS CloudFormation User Guide" https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/
2. AWS Official "CloudFormation Best Practices" https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html
3. AWS Official "Resource and Property Reference" https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html
4. cfn-lint GitHub Repository https://github.com/aws-cloudformation/cfn-lint
5. Rain (CloudFormation CLI tool) https://github.com/aws-cloudformation/rain
6. TaskCat (testing framework) https://github.com/aws-ia/taskcat
