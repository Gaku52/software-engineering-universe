# Amazon API Gateway

> Understand AWS's fully managed API service and implement REST API / HTTP API construction, Lambda integration, and authentication/authorization

## What You Will Learn in This Chapter

1. **API Gateway Fundamentals** — Differences between REST API and HTTP API, choosing endpoint types
2. **Lambda Integration and Proxy Integration** — Serverless API construction patterns
3. **Implementing Authentication and Authorization** — Leveraging Cognito, IAM, and Lambda Authorizers


## Prerequisites

Before reading this guide, having the following knowledge will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts
- Familiarity with the content of [Amazon Route 53](./01-route53.md)

---

## 1. What is API Gateway

API Gateway is a fully managed service for creating, publishing, and managing REST, HTTP, and WebSocket APIs. It can integrate Lambda, EC2, and arbitrary HTTP endpoints as backends.

### Diagram 1: API Gateway Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                              │
│                                                             │
│  Client ──→ [Custom Domain] ──→ [Stage: prod]              │
│             api.example.com        │                        │
│                                    ▼                        │
│                              ┌──────────┐                   │
│                              │ API Def  │                   │
│                              └────┬─────┘                   │
│                                   │                         │
│         ┌─────────────────────────┼──────────────────┐      │
│         ▼                         ▼                  ▼      │
│  ┌─────────────┐          ┌─────────────┐    ┌───────────┐ │
│  │ GET /users  │          │POST /users  │    │GET /health│ │
│  │             │          │             │    │           │ │
│  │ Lambda Fn   │          │ Lambda Fn   │    │ Mock      │ │
│  │ (list)      │          │ (create)    │    │ Integ.    │ │
│  └─────────────┘          └─────────────┘    └───────────┘ │
│         │                         │                         │
│         ▼                         ▼                         │
│  ┌──────────────────────────────────────┐                   │
│  │        Backend                        │                   │
│  │  Lambda / EC2 / ECS / HTTP           │                   │
│  └──────────────────────────────────────┘                   │
│                                                             │
│  Features: Throttling, Caching, Auth,                       │
│            CORS, WAF Integration, CloudWatch Logs           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. REST API vs HTTP API

### Comparison Table 1: REST API vs HTTP API

| Item | REST API | HTTP API |
|------|----------|----------|
| **Protocol** | REST | HTTP (REST compatible) |
| **Cost** | $3.50/1M requests | $1.00/1M requests |
| **Latency** | Slightly higher | Low (up to 60% reduction) |
| **Lambda Integration** | Proxy / Non-proxy | Proxy only |
| **Authentication** | Cognito, IAM, Lambda Auth | Cognito, IAM, JWT |
| **API Key / Usage Plans** | Yes | No |
| **Caching** | Yes | No |
| **WAF Integration** | Yes | No |
| **Request Transformation** | Yes (VTL) | No |
| **WebSocket** | Yes (separate type) | No |
| **Recommended** | When advanced features are needed | Simple APIs (recommended) |

---

## 3. Building APIs

### Code Example 1: Creating a REST API with AWS CLI

```bash
# REST API の作成
aws apigateway create-rest-api \
  --name "MyApp-API" \
  --description "Production REST API" \
  --endpoint-configuration types=REGIONAL

# API ID を取得
API_ID="abc123def4"

# ルートリソース ID を取得
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[?path==`/`].id' \
  --output text)

# /users リソースの作成
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part users

# GET /users メソッドの作成
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id res-users \
  --http-method GET \
  --authorization-type COGNITO_USER_POOLS \
  --authorizer-id auth-cognito

# Lambda プロキシ統合
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id res-users \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:ap-northeast-1:lambda:path/2015-03-31/functions/arn:aws:lambda:ap-northeast-1:123456789012:function:listUsers/invocations"

# デプロイ
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod \
  --stage-description "Production stage"
```

### Code Example 2: Building a Serverless API with SAM Template

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: Serverless API with SAM

Globals:
  Function:
    Runtime: python3.12
    Timeout: 30
    MemorySize: 256
    Environment:
      Variables:
        TABLE_NAME: !Ref UsersTable
        STAGE: !Ref Stage

Parameters:
  Stage:
    Type: String
    Default: prod

Resources:
  # HTTP API (推奨)
  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: !Ref Stage
      CorsConfiguration:
        AllowOrigins:
          - "https://example.com"
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
        AllowHeaders:
          - Authorization
          - Content-Type
      Auth:
        DefaultAuthorizer: CognitoAuthorizer
        Authorizers:
          CognitoAuthorizer:
            AuthorizationScopes:
              - email
            IdentitySource: $request.header.Authorization
            JwtConfiguration:
              issuer: !Sub "https://cognito-idp.ap-northeast-1.amazonaws.com/${UserPool}"
              audience:
                - !Ref UserPoolClient

  # Lambda 関数
  ListUsersFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.list_users
      CodeUri: src/
      Events:
        ListUsers:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /users
            Method: GET

  CreateUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.create_user
      CodeUri: src/
      Events:
        CreateUser:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /users
            Method: POST

  GetUserFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: app.get_user
      CodeUri: src/
      Events:
        GetUser:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /users/{userId}
            Method: GET

  # DynamoDB テーブル
  UsersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Stage}-Users"
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE

Outputs:
  ApiUrl:
    Value: !Sub "https://${HttpApi}.execute-api.ap-northeast-1.amazonaws.com/${Stage}"
```

### Code Example 3: Lambda Handler Implementation

```python
# src/app.py
import json
import os
import boto3
from datetime import datetime
import uuid

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])


def _response(status_code: int, body: dict) -> dict:
    """API Gateway プロキシ統合のレスポンス形式"""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://example.com",
        },
        "body": json.dumps(body, default=str),
    }


def list_users(event, context):
    """GET /users"""
    try:
        # クエリパラメータ
        params = event.get("queryStringParameters") or {}
        limit = int(params.get("limit", 20))

        resp = table.scan(Limit=limit)  # 本番では query を使用
        return _response(200, {
            "users": resp["Items"],
            "count": resp["Count"],
        })
    except Exception as e:
        return _response(500, {"error": str(e)})


def create_user(event, context):
    """POST /users"""
    try:
        body = json.loads(event.get("body", "{}"))
        user_id = str(uuid.uuid4())

        item = {
            "PK": f"USER#{user_id}",
            "SK": "PROFILE",
            "userId": user_id,
            "name": body["name"],
            "email": body["email"],
            "createdAt": datetime.utcnow().isoformat(),
        }
        table.put_item(Item=item)
        return _response(201, {"user": item})
    except KeyError as e:
        return _response(400, {"error": f"Missing field: {e}"})
    except Exception as e:
        return _response(500, {"error": str(e)})


def get_user(event, context):
    """GET /users/{userId}"""
    try:
        user_id = event["pathParameters"]["userId"]
        resp = table.get_item(
            Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}
        )
        item = resp.get("Item")
        if not item:
            return _response(404, {"error": "User not found"})
        return _response(200, {"user": item})
    except Exception as e:
        return _response(500, {"error": str(e)})
```

---

## 4. Authentication and Authorization

### Diagram 2: Comparison of Authentication Methods

```
1. Cognito User Pools (JWT):
   Client ──→ Cognito (ログイン) ──→ JWT Token
   Client ──→ API Gateway ──→ JWT 検証 ──→ Lambda
                │
                └─ Authorization: Bearer <jwt>

2. IAM 認証:
   Client ──→ SigV4 署名 ──→ API Gateway ──→ IAM ポリシー検証 ──→ Lambda
                │
                └─ AWS SDK が自動署名

3. Lambda Authorizer:
   Client ──→ API Gateway ──→ Lambda Authorizer ──→ ポリシー生成
                │                    │
                │                    ├─ Token ベース (JWT/OAuth)
                │                    └─ Request ベース (Header/Query)
                │
                └─ キャッシュ可能 (TTL 設定)

4. API Key:
   Client ──→ API Gateway ──→ API Key 検証 ──→ 使用量プラン確認
                │
                └─ x-api-key: <key>
                   ※ 認証ではなくスロットリング/計測用
```

### Code Example 4: Lambda Authorizer Implementation

```python
# authorizer.py
import json
import jwt
import os
import boto3
from typing import Optional

# JWKS キャッシュ
_jwks_cache = None

def handler(event, context):
    """Lambda Authorizer (Token ベース)"""
    try:
        token = event.get("authorizationToken", "")
        if token.startswith("Bearer "):
            token = token[7:]

        # JWT を検証
        claims = verify_jwt(token)
        if not claims:
            raise Exception("Invalid token")

        # IAM ポリシーを生成
        policy = generate_policy(
            principal_id=claims["sub"],
            effect="Allow",
            resource=event["methodArn"],
            context={
                "userId": claims["sub"],
                "email": claims.get("email", ""),
                "role": claims.get("custom:role", "user"),
            },
        )
        return policy

    except Exception as e:
        print(f"Authorization failed: {e}")
        raise Exception("Unauthorized")


def verify_jwt(token: str) -> Optional[dict]:
    """JWT トークンを検証"""
    try:
        # Cognito の JWKS URL
        issuer = os.environ["TOKEN_ISSUER"]
        audience = os.environ["TOKEN_AUDIENCE"]

        claims = jwt.decode(
            token,
            options={"verify_signature": True},
            algorithms=["RS256"],
            issuer=issuer,
            audience=audience,
        )
        return claims
    except jwt.InvalidTokenError:
        return None


def generate_policy(
    principal_id: str,
    effect: str,
    resource: str,
    context: dict = None,
) -> dict:
    """IAM ポリシードキュメントを生成"""
    # ARN からワイルドカードリソースを生成
    arn_parts = resource.split(":")
    api_gateway_arn = ":".join(arn_parts[:5])
    api_id_stage = arn_parts[5].split("/")
    resource_arn = f"{api_gateway_arn}:{api_id_stage[0]}/{api_id_stage[1]}/*"

    policy = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
                "Action": "execute-api:Invoke",
                "Effect": effect,
                "Resource": resource_arn,
            }],
        },
    }

    if context:
        policy["context"] = context

    return policy
```

---

## 5. Custom Domain and CORS

### Code Example 5: Custom Domain Configuration

```bash
# ACM 証明書の取得（us-east-1 が必要な場合もある）
aws acm request-certificate \
  --domain-name "api.example.com" \
  --validation-method DNS \
  --region ap-northeast-1

# カスタムドメインの作成
aws apigatewayv2 create-domain-name \
  --domain-name "api.example.com" \
  --domain-name-configurations \
    CertificateArn=arn:aws:acm:ap-northeast-1:123456789012:certificate/xxx,EndpointType=REGIONAL

# API マッピングの作成
aws apigatewayv2 create-api-mapping \
  --domain-name "api.example.com" \
  --api-id abc123 \
  --stage prod

# Route 53 に Alias レコードを追加
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890 \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.example.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "d-xxx.execute-api.ap-northeast-1.amazonaws.com",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### Diagram 3: API Gateway Stages and Deployments

```
API Gateway API
  │
  ├─ Stage: dev
  │   ├─ URL: https://abc123.execute-api.ap-ne-1.amazonaws.com/dev
  │   ├─ Stage Variables: {TABLE: "dev-Users", LOG_LEVEL: "DEBUG"}
  │   └─ Deployment: deploy-001
  │
  ├─ Stage: staging
  │   ├─ URL: https://abc123.execute-api.ap-ne-1.amazonaws.com/staging
  │   ├─ Stage Variables: {TABLE: "stg-Users", LOG_LEVEL: "INFO"}
  │   └─ Deployment: deploy-002
  │
  └─ Stage: prod
      ├─ URL: https://abc123.execute-api.ap-ne-1.amazonaws.com/prod
      │   → Custom Domain: api.example.com
      ├─ Stage Variables: {TABLE: "prod-Users", LOG_LEVEL: "WARN"}
      ├─ Deployment: deploy-003
      ├─ Canary: 10% → deploy-004 (new version)
      ├─ Throttle: 10,000 req/s (burst: 5,000)
      └─ Cache: 0.5 GB, TTL 300s
```

### Comparison Table 2: Endpoint Types

| Item | Regional | Edge-Optimized | Private |
|------|----------|----------------|---------|
| **Placement** | Within region | Via CloudFront | Within VPC |
| **Latency** | Minimal when close to region | Globally optimized | Minimal within VPC |
| **Custom Domain** | ACM (same region) | ACM (us-east-1) | None |
| **WAF** | Direct attachment | Via CloudFront | None |
| **Recommended** | Single-region APIs | Global APIs | Internal APIs |

---

## 6. WebSocket API

### Diagram 4: WebSocket API Architecture

```
WebSocket API Routing:
==============================

Client ──→ WebSocket API ──→ Route Selection
               │
    ┌──────────┼──────────────────────┐
    │          │                      │
    ▼          ▼                      ▼
 $connect   $default              $disconnect
 (Lambda)   (Lambda)              (Lambda)
    │                                 │
    ▼                                 ▼
 DynamoDB                          DynamoDB
 (Connection Mgmt)                (Connection Removal)

Custom Routes:
  sendMessage → Lambda → @connections API → Send to other clients
  joinRoom    → Lambda → DynamoDB (Room management)
  typing      → Lambda → @connections API → Typing notification
```

### Code Example 5b: WebSocket API Lambda Handler

```python
# websocket_handler.py
import json
import os
import boto3
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb")
connections_table = dynamodb.Table(os.environ["CONNECTIONS_TABLE"])
api_gateway = boto3.client("apigatewaymanagementapi",
    endpoint_url=os.environ["WEBSOCKET_ENDPOINT"])


def connect_handler(event, context):
    """$connect ルート: WebSocket 接続時"""
    connection_id = event["requestContext"]["connectionId"]
    user_id = event.get("queryStringParameters", {}).get("userId", "anonymous")

    connections_table.put_item(Item={
        "connectionId": connection_id,
        "userId": user_id,
        "connectedAt": datetime.now(timezone.utc).isoformat(),
        "ttl": int(datetime.now(timezone.utc).timestamp()) + 86400,
    })

    return {"statusCode": 200}


def disconnect_handler(event, context):
    """$disconnect ルート: WebSocket 切断時"""
    connection_id = event["requestContext"]["connectionId"]
    connections_table.delete_item(Key={"connectionId": connection_id})
    return {"statusCode": 200}


def send_message_handler(event, context):
    """sendMessage カスタムルート: メッセージの送信"""
    connection_id = event["requestContext"]["connectionId"]
    body = json.loads(event.get("body", "{}"))
    message = body.get("message", "")
    room_id = body.get("roomId", "general")

    # ルーム内の全接続を取得
    response = connections_table.scan(
        FilterExpression="roomId = :room",
        ExpressionAttributeValues={":room": room_id},
    )

    # 各接続にメッセージを送信
    payload = json.dumps({
        "action": "message",
        "message": message,
        "senderId": connection_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }).encode("utf-8")

    stale_connections = []
    for item in response["Items"]:
        target_id = item["connectionId"]
        try:
            api_gateway.post_to_connection(
                ConnectionId=target_id,
                Data=payload,
            )
        except api_gateway.exceptions.GoneException:
            stale_connections.append(target_id)

    # 切断済み接続を削除
    for conn_id in stale_connections:
        connections_table.delete_item(Key={"connectionId": conn_id})

    return {"statusCode": 200}
```

### Code Example 5c: WebSocket API SAM Template

```yaml
Resources:
  WebSocketApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: ChatWebSocket
      ProtocolType: WEBSOCKET
      RouteSelectionExpression: "$request.body.action"

  ConnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: $connect
      AuthorizationType: NONE
      Target: !Sub "integrations/${ConnectIntegration}"

  DisconnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: $disconnect
      Target: !Sub "integrations/${DisconnectIntegration}"

  SendMessageRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: sendMessage
      Target: !Sub "integrations/${SendMessageIntegration}"

  Stage:
    Type: AWS::ApiGatewayV2::Stage
    Properties:
      ApiId: !Ref WebSocketApi
      StageName: prod
      AutoDeploy: true

Outputs:
  WebSocketUrl:
    Value: !Sub "wss://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/prod"
  ConnectionsUrl:
    Value: !Sub "https://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/prod"
```

---

## 7. Throttling and Caching

### REST API Cache Configuration

```bash
# ステージのキャッシュを有効化
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/cacheClusterEnabled,value=true \
    op=replace,path=/cacheClusterSize,value=0.5

# メソッドレベルのキャッシュ設定
aws apigateway update-method \
  --rest-api-id abc123 \
  --resource-id res-users \
  --http-method GET \
  --patch-operations \
    op=replace,path=/cacheKeyParameters/method.request.querystring.page,value=true \
    op=replace,path=/cacheTtlInSeconds,value=300
```

### Throttling Configuration

```
Throttling Hierarchy:
====================

1. Account Level (Default)
   - 10,000 req/s (per region)
   - Burst: 5,000

2. Stage Level
   api.example.com/prod → 5,000 req/s

3. Route Level (REST API)
   GET /users → 1,000 req/s
   POST /orders → 500 req/s

4. Usage Plan + API Key (REST API only)
   Free plan: 100 req/day, 10 req/s
   Pro plan: 10,000 req/day, 100 req/s
   Enterprise plan: 100,000 req/day, 1,000 req/s
```

```bash
# 使用量プランの作成（REST API）
aws apigateway create-usage-plan \
  --name "Free" \
  --description "Free tier usage plan" \
  --api-stages apiId=abc123,stage=prod \
  --throttle burstLimit=10,rateLimit=10 \
  --quota limit=100,period=DAY

# API キーの作成
aws apigateway create-api-key \
  --name "customer-001" \
  --enabled

# API キーを使用量プランに関連付け
aws apigateway create-usage-plan-key \
  --usage-plan-id plan-001 \
  --key-id key-001 \
  --key-type API_KEY

# HTTP API のルートレベルスロットリング
aws apigatewayv2 update-stage \
  --api-id http-abc123 \
  --stage-name prod \
  --route-settings '{
    "GET /users": {
      "ThrottlingBurstLimit": 100,
      "ThrottlingRateLimit": 50
    },
    "POST /orders": {
      "ThrottlingBurstLimit": 50,
      "ThrottlingRateLimit": 20
    }
  }'
```

---

## 8. Monitoring and Logging

### CloudWatch Log Configuration

```bash
# REST API のアクセスログ設定
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/accessLogSettings/destinationArn,value="arn:aws:logs:ap-northeast-1:123456789012:log-group:/api-gateway/prod" \
    op=replace,path=/accessLogSettings/format,value='{"requestId":"$context.requestId","ip":"$context.identity.sourceIp","caller":"$context.identity.caller","user":"$context.identity.user","requestTime":"$context.requestTime","httpMethod":"$context.httpMethod","resourcePath":"$context.resourcePath","status":"$context.status","protocol":"$context.protocol","responseLength":"$context.responseLength","integrationLatency":"$context.integrationLatency"}'

# HTTP API のアクセスログ設定
aws apigatewayv2 update-stage \
  --api-id http-abc123 \
  --stage-name prod \
  --access-log-settings '{
    "DestinationArn": "arn:aws:logs:ap-northeast-1:123456789012:log-group:/api-gateway/http/prod",
    "Format": "{\"requestId\":\"$context.requestId\",\"ip\":\"$context.identity.sourceIp\",\"requestTime\":\"$context.requestTime\",\"httpMethod\":\"$context.httpMethod\",\"path\":\"$context.path\",\"status\":\"$context.status\",\"latency\":\"$context.responseLatency\",\"integrationLatency\":\"$context.integrationLatency\"}"
  }'

# X-Ray トレーシングの有効化
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/tracingEnabled,value=true
```

### Key Metrics

| Metric | Description | Alarm Threshold |
|---|---|---|
| Count | Number of requests | Abnormal spikes/drops |
| 4XXError | Client error rate | > 5% |
| 5XXError | Server error rate | > 1% |
| Latency | End-to-end latency | p99 > 3s |
| IntegrationLatency | Backend latency | p99 > 2s |
| CacheHitCount | Cache hit count | Monitor (for hit rate calculation) |
| CacheMissCount | Cache miss count | Monitor (for hit rate calculation) |

### CloudWatch Alarm Configuration

```bash
# 5xx エラー率アラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "APIGateway-5xx-Error" \
  --alarm-description "API Gateway 5xx error rate exceeds 1%" \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Average \
  --period 300 \
  --threshold 0.01 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions Name=ApiName,Value=MyApp-API \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts

# レイテンシアラーム
aws cloudwatch put-metric-alarm \
  --alarm-name "APIGateway-Latency" \
  --alarm-description "API Gateway p99 latency exceeds 3 seconds" \
  --metric-name Latency \
  --namespace AWS/ApiGateway \
  --extended-statistic p99 \
  --period 300 \
  --threshold 3000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --dimensions Name=ApiName,Value=MyApp-API \
  --alarm-actions arn:aws:sns:ap-northeast-1:123456789012:alerts
```

---

## 9. API Gateway Configuration with Terraform

```hcl
# HTTP API
resource "aws_apigatewayv2_api" "http" {
  name          = "my-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["https://example.com"]
    allow_methods = ["GET", "POST", "PUT", "DELETE"]
    allow_headers = ["Authorization", "Content-Type"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "prod"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_logs.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      path             = "$context.path"
      status           = "$context.status"
      responseLatency  = "$context.responseLatency"
    })
  }

  default_route_settings {
    throttling_burst_limit = 1000
    throttling_rate_limit  = 500
  }
}

# Lambda 統合
resource "aws_apigatewayv2_integration" "list_users" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.list_users.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "list_users" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /users"
  target    = "integrations/${aws_apigatewayv2_integration.list_users.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# JWT Authorizer (Cognito)
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.app.id]
    issuer   = "https://${aws_cognito_user_pool.main.endpoint}"
  }
}

# カスタムドメイン
resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.example.com"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate.api.arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.http.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.prod.id
}

# Route 53 Alias
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
```

---

## 10. Anti-Patterns

### Anti-Pattern 1: Ignoring Lambda Cold Starts

```
[Bad Example]
  API Gateway → Lambda (in VPC, 128MB memory)
  → Cold start: 5-10 seconds
  → Approaches API timeout (29 seconds)

[Good Example]
  Mitigation 1: Provisioned Concurrency
    aws lambda put-provisioned-concurrency-config \
      --function-name myFunction \
      --qualifier prod \
      --provisioned-concurrent-executions 10

  Mitigation 2: Increase memory (CPU scales proportionally)
    MemorySize: 1024  # 128MB → 1024MB

  Mitigation 3: Place outside VPC (when possible)
    → Avoid VPC Lambda ENI creation time

  Mitigation 4: SnapStart (for Java)
    SnapStart:
      ApplyOn: PublishedVersions
```

### Anti-Pattern 2: Consolidating Everything into a Single Lambda Function

```
[Bad Example]
  API Gateway → Single Lambda (handles all endpoints)
  → Deployments affect all endpoints
  → Memory/timeout set to lowest common denominator
  → Excessive permissions (access to all resources)

  def handler(event, context):
      path = event["path"]
      method = event["httpMethod"]
      if path == "/users" and method == "GET":
          return list_users()
      elif path == "/users" and method == "POST":
          return create_user()
      elif path.startswith("/orders"):
          return handle_orders()
      # ... dozens of routes

[Good Example]
  API Gateway → Individual Lambda functions
  GET  /users  → listUsersFunction  (128MB, 5s timeout)
  POST /users  → createUserFunction (256MB, 10s timeout)
  GET  /orders → listOrdersFunction (512MB, 30s timeout)

  Benefits:
  - Individual memory/timeout settings
  - Least-privilege IAM roles
  - Individual deployment and rollback
  - Individual metrics and monitoring
```

---

## 11. Request Validation

With REST APIs, requests can be validated before reaching the backend (Lambda). By rejecting invalid requests early, you can reduce Lambda invocation count and lower costs.

### Code Example 10: Defining Request Models and Validators

```yaml
# SAM テンプレート: リクエストモデルとバリデーター
Resources:
  RestApi:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: validated-api

  # リクエストモデル (JSON Schema)
  CreateUserModel:
    Type: AWS::ApiGateway::Model
    Properties:
      RestApiId: !Ref RestApi
      ContentType: application/json
      Name: CreateUserModel
      Schema:
        $schema: "http://json-schema.org/draft-04/schema#"
        title: CreateUserRequest
        type: object
        required:
          - email
          - name
        properties:
          email:
            type: string
            format: email
            pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
          name:
            type: string
            minLength: 1
            maxLength: 100
          age:
            type: integer
            minimum: 0
            maximum: 150
          role:
            type: string
            enum:
              - admin
              - editor
              - viewer

  # バリデーター
  RequestValidator:
    Type: AWS::ApiGateway::RequestValidator
    Properties:
      RestApiId: !Ref RestApi
      Name: body-and-params-validator
      ValidateRequestBody: true
      ValidateRequestParameters: true

  # メソッドにバリデーターとモデルを適用
  CreateUserMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref RestApi
      ResourceId: !Ref UsersResource
      HttpMethod: POST
      AuthorizationType: COGNITO_USER_POOLS
      RequestValidatorId: !Ref RequestValidator
      RequestModels:
        application/json: !Ref CreateUserModel
      RequestParameters:
        method.request.header.Authorization: true
        method.request.querystring.tenant: true
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${CreateUserFunction.Arn}/invocations"
```

### Code Example 11: HTTP API Parameter Validation (OpenAPI)

```yaml
# openapi.yaml — HTTP API 用
openapi: "3.0.1"
info:
  title: "User API"
  version: "1.0"
paths:
  /users/{userId}:
    get:
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            pattern: "^usr_[a-zA-Z0-9]{12}$"
        - name: fields
          in: query
          required: false
          schema:
            type: string
            enum: [basic, full, minimal]
      x-amazon-apigateway-integration:
        type: aws_proxy
        httpMethod: POST
        uri: "arn:aws:apigateway:ap-northeast-1:lambda:path/2015-03-31/functions/${GetUserFn}/invocations"
        payloadFormatVersion: "2.0"
```

A 400 Bad Request is automatically returned on validation errors.

```json
{
  "message": "Invalid request body",
  "errors": [
    {
      "path": "/email",
      "message": "string does not match pattern"
    }
  ]
}
```

---

## 12. WAF Integration

REST APIs can directly attach AWS WAF, applying SQL injection, XSS, and bot protection at the API level.

### Code Example 12: Creating a WAF WebACL and Attaching to API Gateway

```bash
# WAF WebACL の作成
aws wafv2 create-web-acl \
  --name "api-gateway-waf" \
  --scope REGIONAL \
  --default-action Allow={} \
  --rules '[
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSet"
      }
    },
    {
      "Name": "AWSManagedRulesSQLiRuleSet",
      "Priority": 2,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "SQLiRuleSet"
      }
    },
    {
      "Name": "RateLimit",
      "Priority": 3,
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "Action": {"Block": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimit"
      }
    }
  ]' \
  --visibility-config \
    SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=api-gateway-waf

# WAF を API Gateway ステージにアタッチ
aws wafv2 associate-web-acl \
  --web-acl-arn arn:aws:wafv2:ap-northeast-1:123456789012:regional/webacl/api-gateway-waf/xxx \
  --resource-arn arn:aws:apigateway:ap-northeast-1::/restapis/abc123/stages/prod
```

### Code Example 13: Terraform WAF + API Gateway

```hcl
# WAF WebACL
resource "aws_wafv2_web_acl" "api" {
  name  = "api-gateway-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS マネージドルール: Common Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
    }
  }

  # IP ベースレート制限
  rule {
    name     = "RateLimit"
    priority = 10

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimit"
    }
  }

  # Geo ブロック（特定国からのアクセスを拒否）
  rule {
    name     = "GeoBlock"
    priority = 20

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = ["CN", "RU"]
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "GeoBlock"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "api-gateway-waf"
  }
}

# WAF と REST API ステージの関連付け
resource "aws_wafv2_web_acl_association" "api" {
  resource_arn = aws_api_gateway_stage.prod.arn
  web_acl_arn  = aws_wafv2_web_acl.api.arn
}
```

### Diagram 5: Multi-Layer Defense with WAF

```
Client
    │
    ▼
┌──────────────────────────────────────────────┐
│  AWS WAF                                      │
│  ┌────────────────────────────────────────┐   │
│  │ Rule 1: AWS Managed Common Rules       │   │
│  │  - XSS Detection → Block              │   │
│  │  - Size Limit Exceeded → Block         │   │
│  ├────────────────────────────────────────┤   │
│  │ Rule 2: SQLi Rule Set                  │   │
│  │  - SQL Injection → Block               │   │
│  ├────────────────────────────────────────┤   │
│  │ Rule 3: Rate Limit (2000 req/5min/IP)  │   │
│  │  - Exceeded → Block (429)              │   │
│  ├────────────────────────────────────────┤   │
│  │ Rule 4: Geo Block                      │   │
│  │  - Specific Countries → Block          │   │
│  └────────────────────────────────────────┘   │
│  Default Action: Allow                        │
└──────────────────────────┬───────────────────┘
                           │ Pass
                           ▼
               ┌──────────────────┐
               │  API Gateway     │
               │  (REST API)      │
               │  Throttling +    │
               │  Validation      │
               └────────┬─────────┘
                        │
                        ▼
               ┌──────────────────┐
               │  Lambda Backend  │
               └──────────────────┘
```


---

## Hands-On Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Create test code as well

```python
# 演習1: 基本実装のテンプレート
class Exercise1:
    """基本的な実装パターンの演習"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """入力値の検証"""
        if value is None:
            raise ValueError("入力値がNoneです")
        return True

    def process(self, value):
        """データ処理のメインロジック"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """処理結果の取得"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# テスト
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "例外が発生するべき"
    except ValueError:
        pass

    print("全テスト合格!")

test_exercise1()
```

### Exercise 2: Advanced Patterns

Extend the basic implementation by adding the following features.

```python
# 演習2: 応用パターン
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """応用パターンの演習"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """アイテムの追加（サイズ制限付き）"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """キーによる検索"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """キーによる削除"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """統計情報"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# テスト
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # サイズ制限
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("応用テスト全合格!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# 演習3: パフォーマンス最適化
import time
from functools import lru_cache

# 最適化前（O(n^2)）
def slow_search(data: list, target: int) -> int:
    """非効率な検索"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# 最適化後（O(n)）
def fast_search(data: list, target: int) -> tuple:
    """ハッシュマップを使った効率的な検索"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# ベンチマーク
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

    print(f"非効率版: {slow_time:.4f}秒")
    print(f"効率版:   {fast_time:.6f}秒")
    print(f"高速化率: {slow_time/fast_time:.0f}倍")

benchmark()
```

**Key Points:**
- Be mindful of algorithm computational complexity
- Choose appropriate data structures
- Measure effectiveness with benchmarks
---

## 13. FAQ

### Q1: Should I choose REST API or HTTP API?

**A:** HTTP API is recommended for new projects. It costs 70% less and has lower latency. Choose REST API when you need API key management, usage plans, request transformation (VTL), caching, or direct WAF integration. It is also possible to migrate existing REST APIs to HTTP APIs.

### Q2: How do I configure rate limiting for API Gateway?

**A:** REST API defaults to 10,000 req/s (burst 5,000). Individual throttling is possible with usage plans and API keys. For HTTP API, configure throttling per route. Also consider Lambda concurrency limits, and design API Gateway throttling alongside Lambda Reserved Concurrency.

### Q3: When should I use WebSocket API?

**A:** Use it when real-time bidirectional communication is needed. Typical examples include chat applications, live dashboards, IoT device communication, and online games. WebSocket API defines $connect, $disconnect, $default routes, and custom routes processed by Lambda. Use DynamoDB for connection management and the @connections API to push messages from the server.

### Q4: What causes CORS errors and how do I fix them?

**A:** The three main causes of CORS errors are: (1) CORS is not configured on API Gateway -- for HTTP API, set `CorsConfiguration`; for REST API, add Mock integration to the OPTIONS method. (2) Lambda response is missing CORS headers -- with proxy integration, Lambda must return `Access-Control-Allow-Origin`. (3) Cognito authentication headers are not included in `AllowHeaders` -- explicitly allow the `Authorization` header.

```python
# Lambda プロキシ統合での CORS ヘッダー付与
def lambda_handler(event, context):
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "https://example.com",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
            "Access-Control-Max-Age": "86400"
        },
        "body": json.dumps({"message": "success"})
    }
```

### Q5: How do I work around API Gateway's 29-second timeout?

**A:** The API Gateway integration timeout limit is 29 seconds (not configurable). For long-running processes, adopt the following patterns:

```
Asynchronous Processing Pattern:
1. POST /jobs → Lambda registers job in SQS → Immediately returns jobId (< 1s)
2. Backend Lambda picks up job from SQS and processes it (no time limit)
3. GET /jobs/{jobId} → Poll for processing results

Step Functions Pattern:
1. POST /jobs → Start Step Functions execution → Return executionArn
2. Execute long-running processing within Step Functions
3. GET /jobs/{executionArn} → Get status via DescribeExecution
```

### Q6: What are the key points for API Gateway cost optimization?

**A:** (1) Choose HTTP API (approximately 30% of REST API cost). (2) If using REST API, enable caching to reduce backend invocations. (3) Set quotas per API key with usage plans to prevent overuse. (4) Place CloudFront in front to improve cache hit rates. (5) Balance with Lambda Provisioned Concurrency and avoid unnecessary pre-warming.

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how it works.

### Q2: What are common mistakes beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently used in daily development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Item | Key Point |
|------|---------|
| API Type | HTTP API recommended for new projects. REST API when advanced features are needed |
| Integration Type | Lambda proxy integration is the simplest |
| Authentication | Cognito JWT is the standard. Lambda Authorizer for custom logic |
| Custom Domain | Configure with ACM certificate + Route 53 Alias |
| Stages | Separate environments with dev/staging/prod. Switch settings with Stage Variables |
| Monitoring | Track requests with CloudWatch Logs + X-Ray |
| Cost | HTTP API is $1/1M requests. REST API is $3.5 |

---

## Recommended Next Reads

- [01-route53.md](./01-route53.md) -- Custom domain configuration for API Gateway
- [00-iam-deep-dive.md](../08-security/00-iam-deep-dive.md) -- IAM authentication for API Gateway
- [02-codepipeline.md](../07-devops/02-codepipeline.md) -- CI/CD pipeline for APIs

---

## References

1. **AWS Official Documentation** -- Amazon API Gateway Developer Guide
   https://docs.aws.amazon.com/apigateway/latest/developerguide/
2. **AWS SAM Documentation** -- Serverless Application Model
   https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/
3. **HTTP API vs REST API** -- Selection Guide
   https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html
