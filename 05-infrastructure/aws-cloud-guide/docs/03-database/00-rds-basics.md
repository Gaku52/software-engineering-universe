# Amazon RDS Fundamentals

> Understand AWS's fully managed relational database service and learn practical skills for MySQL/PostgreSQL operations, Multi-AZ deployment, and read replicas

## What You Will Learn in This Chapter

1. **RDS Basic Architecture** — Design decisions for engine selection, instance classes, and storage types
2. **Achieving High Availability** — Multi-AZ deployment, automatic failover, and backup strategies
3. **Read Scaling** — Building and leveraging read replicas, and managing replication lag
4. **Security Design** — VPC placement, encryption, IAM authentication, and audit log configuration
5. **Infrastructure as Code** — Declarative RDS management with CloudFormation / CDK


## Prerequisites

Before reading this guide, the following knowledge will help deepen your understanding:

- Basic programming knowledge
- Understanding of related fundamental concepts

---

## 1. RDS Architecture Overview

### Positioning of RDS

```
+----------------------------------------------------------+
|                      AWS Cloud                           |
|  +----------------------------------------------------+  |
|  |                    VPC                              |  |
|  |  +--------------------+  +----------------------+  |  |
|  |  |  Public Subnet     |  |  Private Subnet      |  |  |
|  |  |  +-------------+   |  |  +----------------+  |  |  |
|  |  |  | EC2 / ECS   |   |  |  | RDS Primary    |  |  |  |
|  |  |  | (App Layer)  |-------->| (MySQL/PgSQL)  |  |  |  |
|  |  |  +-------------+   |  |  +-------+--------+  |  |  |
|  |  +--------------------+  |          |            |  |  |
|  |                          |          | Sync Repl  |  |  |
|  |  +--------------------+  |  +-------v--------+   |  |  |
|  |  |  Another AZ        |  |  | RDS Standby    |   |  |  |
|  |  |                    |  |  | (Multi-AZ)     |   |  |  |
|  |  +--------------------+  |  +----------------+   |  |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
```

### RDS Managed Scope

```
+-------------------------------+-------------------------------+
|      User's Responsibility    |      Managed by RDS           |
+-------------------------------+-------------------------------+
| Application optimization      | OS patching                   |
| Query tuning                  | Database engine updates        |
| Schema design                 | Automatic backups              |
| Index management              | Snapshot management            |
| Parameter group tuning        | Multi-AZ failover              |
| Security group configuration  | Storage auto-scaling           |
| Backup retention decisions    | Health monitoring              |
| Encryption configuration      | Automatic recovery from HW failure |
+-------------------------------+-------------------------------+
```

### Code Example 1: Creating an RDS Instance (AWS CLI)

```bash
# Create a MySQL 8.0 RDS instance
aws rds create-db-instance \
  --db-instance-identifier my-mysql-db \
  --db-instance-class db.r6g.large \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password 'SecureP@ssw0rd!' \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --kms-key-id alias/rds-key \
  --multi-az \
  --vpc-security-group-ids sg-0abc123def456 \
  --db-subnet-group-name my-db-subnet-group \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "Mon:04:00-Mon:05:00" \
  --auto-minor-version-upgrade \
  --enable-performance-insights \
  --performance-insights-retention-period 731 \
  --monitoring-interval 60 \
  --monitoring-role-arn arn:aws:iam::123456789012:role/rds-monitoring-role \
  --enable-cloudwatch-logs-exports '["audit","error","general","slowquery"]' \
  --copy-tags-to-snapshot \
  --deletion-protection \
  --tags Key=Environment,Value=production Key=Team,Value=backend

# Check creation status
aws rds wait db-instance-available \
  --db-instance-identifier my-mysql-db

# Get the endpoint
aws rds describe-db-instances \
  --db-instance-identifier my-mysql-db \
  --query 'DBInstances[0].Endpoint.{Address:Address,Port:Port}'
```

### Code Example 2: RDS Definition with Terraform

```hcl
resource "aws_db_instance" "main" {
  identifier     = "app-mysql-prod"
  engine         = "mysql"
  engine_version = "8.0.35"
  instance_class = "db.r6g.large"

  # Storage
  allocated_storage     = 100
  max_allocated_storage = 500   # Auto-scaling upper limit
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.rds.arn

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # High availability
  multi_az = true

  # Authentication
  username = "admin"
  password = var.db_password  # Secrets Manager recommended

  # Backup
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Parameters
  parameter_group_name = aws_db_parameter_group.mysql80.name

  # Deletion protection
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "app-mysql-prod-final"

  # Monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 731
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports       = ["audit", "error", "slowquery"]

  tags = {
    Environment = "production"
  }
}

resource "aws_db_parameter_group" "mysql80" {
  family = "mysql8.0"
  name   = "app-mysql80-params"

  parameter {
    name  = "character_set_server"
    value = "utf8mb4"
  }

  parameter {
    name  = "collation_server"
    value = "utf8mb4_unicode_ci"
  }

  parameter {
    name  = "slow_query_log"
    value = "1"
  }

  parameter {
    name  = "long_query_time"
    value = "1"
  }

  parameter {
    name  = "log_output"
    value = "FILE"
  }

  parameter {
    name         = "innodb_buffer_pool_size"
    value        = "{DBInstanceClassMemory*3/4}"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "app-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "app-db-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
    description     = "MySQL from application layer"
  }

  tags = {
    Name = "rds-security-group"
  }
}
```

---

## 2. Engine Comparison

### RDS Supported Engine Comparison

| Engine | Version Examples | Max Storage | Features | Use Cases |
|---|---|---|---|---|
| **MySQL** | 8.0, 8.4 | 64 TiB | Wide compatibility, large community | General web apps |
| **PostgreSQL** | 15, 16 | 64 TiB | Extensibility, JSON support, GIS | Analytics, geospatial data |
| **MariaDB** | 10.6, 10.11 | 64 TiB | MySQL compatible, additional features | MySQL alternative |
| **Oracle** | 19c, 21c | 64 TiB | Enterprise features | Core system migration |
| **SQL Server** | 2019, 2022 | 16 TiB | Windows integration | .NET apps |
| **Aurora MySQL** | 3 (MySQL 8.0 compatible) | 128 TiB | High performance, auto-scaling | High-load web |
| **Aurora PostgreSQL** | 15, 16 compatible | 128 TiB | High performance, Babelfish | Enterprise |

### MySQL vs PostgreSQL Selection Criteria

| Aspect | MySQL | PostgreSQL |
|---|---|---|
| **Learning Curve** | Low | Slightly higher |
| **JSON Operations** | Basic | Advanced (JSONB, index support) |
| **Full-text Search** | Available | Advanced (tsvector/tsquery) |
| **Geospatial** | Basic | Advanced with PostGIS |
| **Partitioning** | RANGE/LIST/HASH | Declarative partitioning |
| **Replication** | binlog | WAL-based (logical/physical) |
| **Extensibility** | Plugins | Flexible via Extensions |
| **Concurrent Connection Performance** | High | Medium to high (connection pooling recommended) |
| **Window Functions** | Supported since 8.0 | Advanced support |
| **CTE (Recursive)** | Supported since 8.0 | Supported since early versions |

### Instance Class Selection

```
Instance Class Selection Flow
==============================

Start
 |
 v
Production environment?
 |           |
 Yes         No (Dev/Test)
 |           |
 v           v
Memory-optimized  General purpose
db.r6g/r7g        db.t3/t4g
 |                (Burstable)
 |
 v
Graviton-compatible engine?
 |           |
 Yes         No
 |           |
 v           v
db.r7g      db.r6i
(Best value) (Intel)

Instance class naming convention:
  db.r6g.2xlarge
  |  | | |
  |  | | +-- Size (large, xlarge, 2xlarge, ...)
  |  | +---- Processor (g=Graviton, i=Intel, none=default)
  |  +------ Generation (6, 7)
  +--------- Family (r=memory-optimized, m=general purpose, t=burstable)
```

| Class | vCPU | Memory | Use Case | Estimated Monthly Cost (Tokyo) |
|-------|------|--------|----------|-------------------------------|
| db.t3.micro | 2 | 1 GiB | Dev/Test | ~$25 |
| db.t3.medium | 2 | 4 GiB | Small-scale production | ~$100 |
| db.r6g.large | 2 | 16 GiB | Medium-scale production | ~$250 |
| db.r6g.xlarge | 4 | 32 GiB | Large-scale production | ~$500 |
| db.r6g.2xlarge | 8 | 64 GiB | High-load production | ~$1,000 |
| db.r7g.4xlarge | 16 | 128 GiB | Large-scale enterprise | ~$2,000 |

---

## 3. Storage Type Selection

```
Storage Selection Flowchart
============================

Start
 |
 v
Is 3,000 IOPS or less sufficient?
 |           |
 Yes         No
 |           |
 v           v
gp3        IOPS requirement?
(General)   |         |
           ~64,000   ~256,000
            |         |
            v         v
          gp3       io2 Block
        (Custom IOPS) Express
```

### Detailed Storage Type Comparison

| Item | gp3 | gp2 (Legacy) | io1 | io2 | io2 Block Express |
|------|-----|---------|-----|-----|-------------------|
| Baseline IOPS | 3,000 | Proportional to capacity | Specified | Specified | Specified |
| Max IOPS | 16,000 | 16,000 | 64,000 | 64,000 | 256,000 |
| Max Throughput | 1,000 MiB/s | 250 MiB/s | 1,000 MiB/s | 1,000 MiB/s | 4,000 MiB/s |
| IOPS/GiB Ratio | Independent | 3:1 | 50:1 | 500:1 | 1,000:1 |
| Durability | 99.8-99.9% | 99.8-99.9% | 99.8-99.9% | 99.999% | 99.999% |
| Cost | Lowest | Slightly higher | High | High | Very high |

### Code Example 3: Storage Auto-Scaling and Monitoring

```bash
# Add storage auto-scaling to an existing instance
aws rds modify-db-instance \
  --db-instance-identifier my-mysql-db \
  --max-allocated-storage 500 \
  --apply-immediately

# Migrate from gp2 to gp3 (cost reduction)
aws rds modify-db-instance \
  --db-instance-identifier my-mysql-db \
  --storage-type gp3 \
  --iops 3000 \
  --storage-throughput 125 \
  --apply-immediately

# Monitor storage usage (CloudWatch)
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name FreeStorageSpace \
  --dimensions Name=DBInstanceIdentifier,Value=my-mysql-db \
  --start-time 2026-02-10T00:00:00Z \
  --end-time 2026-02-11T00:00:00Z \
  --period 3600 \
  --statistics Average \
  --unit Bytes

# Set up storage usage alarm (notify when less than 10GB remaining)
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-FreeStorage-Low" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=my-mysql-db \
  --statistic Average \
  --period 300 \
  --evaluation-periods 3 \
  --threshold 10737418240 \
  --comparison-operator LessThanThreshold \
  --alarm-actions "arn:aws:sns:ap-northeast-1:123456789012:alerts" \
  --unit Bytes
```

---

## 4. Multi-AZ Deployment

### How Failover Works

```
Normal operation:
+----------+    Synchronous Replication    +----------+
| Primary  | ========================> | Standby  |
| (AZ-1a)  |                          | (AZ-1c)  |
+----+-----+                          +----------+
     ^
     |  DNS: mydb.xxxx.ap-northeast-1.rds.amazonaws.com
     |
+----+-----+
| App      |
+----------+

During failure:
+----------+                           +----------+
| Primary  |   X  Connection lost     | Standby  |
| (AZ-1a)  |                          | -> Primary|
+----------+                          +----+-----+
  Failure                                   ^
                                           |  Automatic DNS switchover
                                           |  (60-120 seconds)
                                      +----+-----+
                                      | App      |
                                      +----------+

Multi-AZ Cluster (new approach):
+----------+    Sync    +-----------+    Sync    +-----------+
| Writer   | ========> | Reader 1  | ========> | Reader 2  |
| (AZ-1a)  |           | (AZ-1c)   |           | (AZ-1d)   |
+----------+           +-----------+           +-----------+
  ^ Writes               ^ Reads                 ^ Reads
  rw-endpoint             ro-endpoint             ro-endpoint

  Failover time: ~35 seconds (faster than traditional Multi-AZ)
```

### Multi-AZ Instance vs Multi-AZ Cluster

| Item | Multi-AZ Instance | Multi-AZ Cluster |
|------|---------------------|-------------------|
| Standby | 1 instance (not readable) | 2 instances (readable) |
| Failover | 60-120 seconds | ~35 seconds |
| Read endpoint | None | Available |
| Supported engines | All engines | MySQL, PostgreSQL |
| Storage | EBS | Local NVMe + EBS |
| Cost | ~2x | ~3x |
| Use case | Standard HA | High-performance HA + read scaling |

### Code Example 4: Multi-AZ Failover Testing

```bash
# Manual failover execution (for testing)
aws rds reboot-db-instance \
  --db-instance-identifier my-mysql-db \
  --force-failover

# Check failover events
aws rds describe-events \
  --source-type db-instance \
  --source-identifier my-mysql-db \
  --duration 60

# Check Multi-AZ status
aws rds describe-db-instances \
  --db-instance-identifier my-mysql-db \
  --query 'DBInstances[0].{MultiAZ:MultiAZ,AZ:AvailabilityZone,SecondaryAZ:SecondaryAvailabilityZone}'

# Detect failover with EventBridge
aws events put-rule \
  --name rds-failover-notification \
  --event-pattern '{
    "source": ["aws.rds"],
    "detail-type": ["RDS DB Instance Event"],
    "detail": {
      "EventCategories": ["failover"],
      "SourceType": ["DB_INSTANCE"]
    }
  }'

aws events put-targets \
  --rule rds-failover-notification \
  --targets '[{
    "Id": "sns-target",
    "Arn": "arn:aws:sns:ap-northeast-1:123456789012:alerts"
  }]'
```

---

## 5. Read Replicas

### Read Replica Architecture

```
Read Replica Configuration

+----------+   Asynchronous Replication   +-----------+
| Primary  | =======================> | Read      |
| (Writer) |                          | Replica 1 |
|          |                          | (AZ-1c)   |
|          |                          +-----------+
|          |
|          |   Asynchronous Replication   +-----------+
|          | =======================> | Read      |
|          |                          | Replica 2 |
|          |                          | (AZ-1d)   |
+----------+                          +-----------+

  ^ Writes                              ^ Reads
  (Primary endpoint)                    (Each replica's endpoint)

Note: Since replication is asynchronous, replication lag occurs
      Monitoring via the ReplicaLag metric is required
```

### Code Example 5: Creating and Using Read Replicas

```bash
# Create a read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier my-mysql-db-read1 \
  --source-db-instance-identifier my-mysql-db \
  --db-instance-class db.r6g.large \
  --availability-zone ap-northeast-1c \
  --storage-type gp3 \
  --max-allocated-storage 500 \
  --enable-performance-insights \
  --performance-insights-retention-period 731 \
  --monitoring-interval 60 \
  --monitoring-role-arn arn:aws:iam::123456789012:role/rds-monitoring-role

# Second read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier my-mysql-db-read2 \
  --source-db-instance-identifier my-mysql-db \
  --db-instance-class db.r6g.large \
  --availability-zone ap-northeast-1d

# Cross-region read replica (for DR)
aws rds create-db-instance-read-replica \
  --db-instance-identifier my-mysql-db-us-read \
  --source-db-instance-identifier arn:aws:rds:ap-northeast-1:123456789:db:my-mysql-db \
  --db-instance-class db.r6g.large \
  --region us-east-1

# Monitor replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ReplicaLag \
  --dimensions Name=DBInstanceIdentifier,Value=my-mysql-db-read1 \
  --start-time "$(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 \
  --statistics Average

# Replication lag alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-ReplicaLag-High" \
  --metric-name ReplicaLag \
  --namespace AWS/RDS \
  --dimensions Name=DBInstanceIdentifier,Value=my-mysql-db-read1 \
  --statistic Average \
  --period 60 \
  --evaluation-periods 3 \
  --threshold 30 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions "arn:aws:sns:ap-northeast-1:123456789012:alerts"

# Promote read replica to standalone DB
aws rds promote-read-replica \
  --db-instance-identifier my-mysql-db-read1
```

### Code Example 6: Read/Write Splitting in Application (Python)

```python
import pymysql
from contextlib import contextmanager
import random
import time

class DatabaseRouter:
    """Database router for read/write splitting"""

    def __init__(self):
        self.writer_config = {
            'host': 'my-mysql-db.xxxx.ap-northeast-1.rds.amazonaws.com',
            'user': 'admin',
            'password': 'secret',
            'database': 'myapp',
            'charset': 'utf8mb4',
            'connect_timeout': 5,
            'read_timeout': 30,
        }
        self.reader_configs = [
            {
                'host': 'my-mysql-db-read1.xxxx.ap-northeast-1.rds.amazonaws.com',
                'user': 'readonly',
                'password': 'secret',
                'database': 'myapp',
                'charset': 'utf8mb4',
                'connect_timeout': 5,
                'read_timeout': 30,
            },
            {
                'host': 'my-mysql-db-read2.xxxx.ap-northeast-1.rds.amazonaws.com',
                'user': 'readonly',
                'password': 'secret',
                'database': 'myapp',
                'charset': 'utf8mb4',
                'connect_timeout': 5,
                'read_timeout': 30,
            },
        ]
        self._reader_index = 0

    def _connect_with_retry(self, config, max_retries=3):
        """Connection with retry"""
        for attempt in range(max_retries):
            try:
                return pymysql.connect(**config)
            except pymysql.OperationalError as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(0.5 * (attempt + 1))

    @contextmanager
    def writer(self):
        """Connection for writes"""
        conn = self._connect_with_retry(self.writer_config)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @contextmanager
    def reader(self):
        """Connection for reads (round-robin)"""
        config = self.reader_configs[self._reader_index]
        self._reader_index = (self._reader_index + 1) % len(self.reader_configs)
        conn = self._connect_with_retry(config)
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def consistent_reader(self):
        """Read from primary when consistency is required"""
        conn = self._connect_with_retry(self.writer_config)
        try:
            yield conn
        finally:
            conn.close()

# Usage examples
db = DatabaseRouter()

# Writes go to the primary
with db.writer() as conn:
    with conn.cursor() as cur:
        cur.execute("INSERT INTO users (name, email) VALUES (%s, %s)",
                    ("Taro", "taro@example.com"))

# Reads go to read replicas
with db.reader() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE id = %s", (1,))
        user = cur.fetchone()

# Read immediately after write (avoiding replication lag)
with db.consistent_reader() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email = %s", ("taro@example.com",))
        user = cur.fetchone()
```

### Code Example: Connection Management with RDS Proxy

```bash
# Create an RDS Proxy
aws rds create-db-proxy \
  --db-proxy-name my-app-proxy \
  --engine-family MYSQL \
  --auth '[{
    "AuthScheme": "SECRETS",
    "SecretArn": "arn:aws:secretsmanager:ap-northeast-1:123456789012:secret:my-db-creds",
    "IAMAuth": "DISABLED"
  }]' \
  --role-arn arn:aws:iam::123456789012:role/rds-proxy-role \
  --vpc-subnet-ids subnet-aaa subnet-bbb subnet-ccc \
  --vpc-security-group-ids sg-proxy123 \
  --require-tls \
  --idle-client-timeout 1800

# Register the target group
aws rds register-db-proxy-targets \
  --db-proxy-name my-app-proxy \
  --db-instance-identifiers my-mysql-db

# Get the Proxy endpoint
aws rds describe-db-proxies \
  --db-proxy-name my-app-proxy \
  --query 'DBProxies[0].Endpoint'

# Create a Proxy reader endpoint (for reads)
aws rds create-db-proxy-endpoint \
  --db-proxy-name my-app-proxy \
  --db-proxy-endpoint-name my-app-proxy-reader \
  --target-role READ_ONLY \
  --vpc-subnet-ids subnet-aaa subnet-bbb subnet-ccc
```

```
Benefits of RDS Proxy:
1. Connection pooling: Efficiently manages short-lived connections from Lambda, etc.
2. Faster failover: Proxy abstracts failover (reduces switchover time)
3. IAM authentication: Use IAM authentication instead of database passwords
4. TLS enforcement: Enforces encryption between client and Proxy
5. Pinning: Pins queries within the same session to the same connection
```

---

## 6. Backup and Recovery

### How Backups Work

```
RDS Backup Strategy

Automatic backups:
  Daily snapshot (within backup window)
  + Transaction logs (every 5 minutes)
  = Point-in-Time Recovery (PITR)
  Retention period: 1-35 days (default 7 days)

  +--+--+--+--+--+--+--+--+--+--+--+--+
  |Su|Mo|Tu|We|Th|Fr|Sa|Su|Mo|Tu|We|Th|
  +--+--+--+--+--+--+--+--+--+--+--+--+
   ^  ^  ^  ^  ^  ^  ^             ^
   Snapshots                       Latest Restorable Time

Manual snapshots:
  - Not automatically deleted (retained until manually deleted)
  - Can be copied across regions (for DR)
  - Can be shared across accounts
```

### Code Example 7: Point-in-Time Recovery

```bash
# Check the latest restorable time
aws rds describe-db-instances \
  --db-instance-identifier my-mysql-db \
  --query 'DBInstances[0].LatestRestorableTime'

# Restore to a specific point in time (created as a new instance)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier my-mysql-db \
  --target-db-instance-identifier my-mysql-db-restored \
  --restore-time "2026-02-10T15:30:00Z" \
  --db-instance-class db.r6g.large \
  --db-subnet-group-name my-db-subnet-group \
  --vpc-security-group-ids sg-0abc123def456 \
  --multi-az \
  --storage-type gp3 \
  --copy-tags-to-snapshot

# Restore to the latest restorable time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier my-mysql-db \
  --target-db-instance-identifier my-mysql-db-latest \
  --use-latest-restorable-time \
  --db-instance-class db.r6g.large

# Create a manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier my-mysql-db \
  --db-snapshot-identifier my-mysql-db-snap-20260211

# Restore from a snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier my-mysql-db-from-snap \
  --db-snapshot-identifier my-mysql-db-snap-20260211 \
  --db-instance-class db.r6g.large

# Copy snapshot to another region (for DR)
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:ap-northeast-1:123456789012:snapshot:my-mysql-db-snap-20260211 \
  --target-db-snapshot-identifier my-mysql-db-snap-us-copy \
  --region us-east-1 \
  --kms-key-id alias/rds-dr-key

# Share snapshot with another account
aws rds modify-db-snapshot-attribute \
  --db-snapshot-identifier my-mysql-db-snap-20260211 \
  --attribute-name restore \
  --values-to-add "987654321098"
```

### Code Example: Cross-Region Replication of Automatic Backups

```bash
# Replicate automatic backups to another region
aws rds start-db-instance-automated-backups-replication \
  --source-db-instance-arn arn:aws:rds:ap-northeast-1:123456789012:db:my-mysql-db \
  --backup-retention-period 7 \
  --kms-key-id alias/rds-dr-key \
  --region us-east-1

# Check replication status
aws rds describe-db-instance-automated-backups \
  --db-instance-automated-backups-arn arn:aws:rds:us-east-1:123456789012:auto-backup:xxx \
  --region us-east-1
```

---

## 7. Monitoring and Performance Tuning

### Key CloudWatch Metrics

| Metric | Threshold (Guideline) | Action |
|-----------|------------|------|
| CPUUtilization | > 80% | Scale up instance class |
| FreeableMemory | < 256 MB | Scale up, optimize queries |
| FreeStorageSpace | < 10 GB | Expand storage, delete old data |
| ReadIOPS / WriteIOPS | Exceeds baseline | Increase gp3 IOPS, switch to io2 |
| ReplicaLag | > 30 seconds | Scale up replica, enable parallel replication |
| DatabaseConnections | > 80% of max | Introduce RDS Proxy, connection pooling |
| SwapUsage | > 0 | Insufficient memory, scale up |
| DiskQueueDepth | > 64 | Increase storage IOPS |

### Code Example 8: Leveraging Performance Insights

```bash
# Enable Performance Insights
aws rds modify-db-instance \
  --db-instance-identifier my-mysql-db \
  --enable-performance-insights \
  --performance-insights-retention-period 731 \
  --performance-insights-kms-key-id alias/rds-pi-key \
  --apply-immediately

# Get top wait events
aws pi get-resource-metrics \
  --service-type RDS \
  --identifier db-XXXXXXXXXXXXXXXXXXXX \
  --metric-queries '[{
    "Metric": "db.load.avg",
    "GroupBy": {
      "Group": "db.wait_event",
      "Limit": 5
    }
  }]' \
  --start-time 2026-02-10T00:00:00Z \
  --end-time 2026-02-11T00:00:00Z \
  --period-in-seconds 3600

# Get top SQL queries
aws pi get-resource-metrics \
  --service-type RDS \
  --identifier db-XXXXXXXXXXXXXXXXXXXX \
  --metric-queries '[{
    "Metric": "db.load.avg",
    "GroupBy": {
      "Group": "db.sql",
      "Limit": 10
    }
  }]' \
  --start-time 2026-02-10T00:00:00Z \
  --end-time 2026-02-11T00:00:00Z \
  --period-in-seconds 3600

# Enable Enhanced Monitoring (OS-level metrics)
aws rds modify-db-instance \
  --db-instance-identifier my-mysql-db \
  --monitoring-interval 60 \
  --monitoring-role-arn arn:aws:iam::123456789012:role/rds-monitoring-role \
  --apply-immediately
```

### Code Example: Creating a CloudWatch Dashboard

```bash
# Create an RDS monitoring dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "RDS-Monitoring" \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "properties": {
          "title": "CPU Utilization",
          "metrics": [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "my-mysql-db"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "ap-northeast-1",
          "yAxis": {"left": {"min": 0, "max": 100}}
        },
        "width": 12, "height": 6, "x": 0, "y": 0
      },
      {
        "type": "metric",
        "properties": {
          "title": "Database Connections",
          "metrics": [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "my-mysql-db"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "ap-northeast-1"
        },
        "width": 12, "height": 6, "x": 12, "y": 0
      },
      {
        "type": "metric",
        "properties": {
          "title": "IOPS",
          "metrics": [
            ["AWS/RDS", "ReadIOPS", "DBInstanceIdentifier", "my-mysql-db"],
            ["AWS/RDS", "WriteIOPS", "DBInstanceIdentifier", "my-mysql-db"]
          ],
          "period": 300,
          "stat": "Average",
          "region": "ap-northeast-1"
        },
        "width": 12, "height": 6, "x": 0, "y": 6
      },
      {
        "type": "metric",
        "properties": {
          "title": "Replica Lag",
          "metrics": [
            ["AWS/RDS", "ReplicaLag", "DBInstanceIdentifier", "my-mysql-db-read1"],
            ["AWS/RDS", "ReplicaLag", "DBInstanceIdentifier", "my-mysql-db-read2"]
          ],
          "period": 60,
          "stat": "Average",
          "region": "ap-northeast-1"
        },
        "width": 12, "height": 6, "x": 12, "y": 6
      }
    ]
  }'
```

---

## 8. Security

### 8.1 VPC and Network

```bash
# Create a DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name my-db-subnet-group \
  --db-subnet-group-description "Private subnets for RDS" \
  --subnet-ids subnet-aaa111 subnet-bbb222 subnet-ccc333

# Create a security group
SG_ID=$(aws ec2 create-security-group \
  --group-name rds-mysql-sg \
  --description "Security group for RDS MySQL" \
  --vpc-id vpc-xxx \
  --query 'GroupId' --output text)

# Allow MySQL port only from the application layer
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3306 \
  --source-group sg-app-layer

# Also allow connections from Bastion / SSM (for administrators)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 3306 \
  --source-group sg-bastion
```

### 8.2 IAM Database Authentication

```bash
# Enable IAM authentication
aws rds modify-db-instance \
  --db-instance-identifier my-mysql-db \
  --enable-iam-database-authentication \
  --apply-immediately

# Create an IAM authentication user in MySQL
# mysql> CREATE USER 'iam_user'@'%' IDENTIFIED WITH AWSAuthenticationPlugin AS 'RDS';
# mysql> GRANT SELECT ON myapp.* TO 'iam_user'@'%';

# IAM policy example
# {
#   "Version": "2012-10-17",
#   "Statement": [{
#     "Effect": "Allow",
#     "Action": "rds-db:connect",
#     "Resource": "arn:aws:rds-db:ap-northeast-1:123456789012:dbuser:cluster-xxx/iam_user"
#   }]
# }

# Get IAM authentication token and connect
TOKEN=$(aws rds generate-db-auth-token \
  --hostname my-mysql-db.xxxx.ap-northeast-1.rds.amazonaws.com \
  --port 3306 \
  --username iam_user)

mysql -h my-mysql-db.xxxx.ap-northeast-1.rds.amazonaws.com \
  -u iam_user \
  --password=$TOKEN \
  --ssl-mode=REQUIRED \
  --ssl-ca=global-bundle.pem
```

### 8.3 Encryption

```bash
# Check if instance is encrypted
aws rds describe-db-instances \
  --db-instance-identifier my-mysql-db \
  --query 'DBInstances[0].{StorageEncrypted:StorageEncrypted,KmsKeyId:KmsKeyId}'

# Encrypt an unencrypted instance (via snapshot)
# 1. Take a snapshot
aws rds create-db-snapshot \
  --db-instance-identifier my-mysql-db-unencrypted \
  --db-snapshot-identifier my-mysql-db-unenc-snap

# 2. Create an encrypted copy
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier my-mysql-db-unenc-snap \
  --target-db-snapshot-identifier my-mysql-db-encrypted-snap \
  --kms-key-id alias/rds-key

# 3. Restore from the encrypted snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier my-mysql-db-encrypted \
  --db-snapshot-identifier my-mysql-db-encrypted-snap

# 4. Switch application connection to the new instance, then delete the old one

# Enforce SSL/TLS connections (parameter group)
# MySQL: require_secure_transport = 1
# PostgreSQL: rds.force_ssl = 1
```

---

## 9. Instance Stop and Start

```bash
# Temporarily stop an RDS instance (up to 7 days)
aws rds stop-db-instance \
  --db-instance-identifier my-dev-db

# The instance auto-starts after 7 days; a script is needed for continuous stopping

# Start an RDS instance
aws rds start-db-instance \
  --db-instance-identifier my-dev-db

# Automate scheduled stop/start for dev environments with Lambda
# EventBridge rule: Stop at 20:00 on weekdays, start at 8:00 next morning
aws events put-rule \
  --name stop-dev-rds-nightly \
  --schedule-expression "cron(0 11 ? * MON-FRI *)" \
  --description "Stop dev RDS at 20:00 JST"

aws events put-rule \
  --name start-dev-rds-morning \
  --schedule-expression "cron(0 23 ? * SUN-THU *)" \
  --description "Start dev RDS at 8:00 JST"
```

---

## 10. Building with CloudFormation / CDK

### 10.1 CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Production RDS MySQL with Multi-AZ and Read Replica

Parameters:
  VpcId:
    Type: AWS::EC2::VPC::Id
  PrivateSubnetIds:
    Type: List<AWS::EC2::Subnet::Id>
  AppSecurityGroupId:
    Type: AWS::EC2::SecurityGroup::Id
  DBPassword:
    Type: String
    NoEcho: true
    Description: Master password (Secrets Manager recommended)

Resources:
  # KMS Key
  RDSKey:
    Type: AWS::KMS::Key
    Properties:
      Description: RDS encryption key
      KeyPolicy:
        Version: '2012-10-17'
        Statement:
          - Sid: AllowRootAccount
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
            Action: 'kms:*'
            Resource: '*'

  # DB Subnet Group
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Private subnets for RDS
      SubnetIds: !Ref PrivateSubnetIds

  # Security Group
  DBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: RDS MySQL Security Group
      VpcId: !Ref VpcId
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3306
          ToPort: 3306
          SourceSecurityGroupId: !Ref AppSecurityGroupId
          Description: MySQL from app layer

  # Parameter Group
  DBParameterGroup:
    Type: AWS::RDS::DBParameterGroup
    Properties:
      Family: mysql8.0
      Description: Custom MySQL 8.0 parameters
      Parameters:
        character_set_server: utf8mb4
        collation_server: utf8mb4_unicode_ci
        slow_query_log: '1'
        long_query_time: '1'
        require_secure_transport: '1'

  # Primary Instance
  DBInstance:
    Type: AWS::RDS::DBInstance
    DeletionPolicy: Snapshot
    Properties:
      DBInstanceIdentifier: !Sub '${AWS::StackName}-mysql'
      Engine: mysql
      EngineVersion: '8.0.35'
      DBInstanceClass: db.r6g.large
      AllocatedStorage: 100
      MaxAllocatedStorage: 500
      StorageType: gp3
      StorageEncrypted: true
      KmsKeyId: !Ref RDSKey
      MultiAZ: true
      MasterUsername: admin
      MasterUserPassword: !Ref DBPassword
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref DBSecurityGroup
      DBParameterGroupName: !Ref DBParameterGroup
      BackupRetentionPeriod: 7
      PreferredBackupWindow: '03:00-04:00'
      PreferredMaintenanceWindow: 'Mon:04:00-Mon:05:00'
      AutoMinorVersionUpgrade: true
      DeletionProtection: true
      CopyTagsToSnapshot: true
      EnablePerformanceInsights: true
      PerformanceInsightsRetentionPeriod: 731
      MonitoringInterval: 60
      MonitoringRoleArn: !GetAtt MonitoringRole.Arn
      EnableCloudwatchLogsExports:
        - audit
        - error
        - slowquery

  # Read Replica
  ReadReplica:
    Type: AWS::RDS::DBInstance
    DependsOn: DBInstance
    Properties:
      DBInstanceIdentifier: !Sub '${AWS::StackName}-mysql-read1'
      SourceDBInstanceIdentifier: !Ref DBInstance
      DBInstanceClass: db.r6g.large
      StorageType: gp3
      EnablePerformanceInsights: true
      PerformanceInsightsRetentionPeriod: 731
      MonitoringInterval: 60
      MonitoringRoleArn: !GetAtt MonitoringRole.Arn

  # IAM Role for Enhanced Monitoring
  MonitoringRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: monitoring.rds.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole

  # CPU Utilization Alarm
  CPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-rds-cpu-high'
      MetricName: CPUUtilization
      Namespace: AWS/RDS
      Dimensions:
        - Name: DBInstanceIdentifier
          Value: !Ref DBInstance
      Statistic: Average
      Period: 300
      EvaluationPeriods: 3
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Sub 'arn:aws:sns:${AWS::Region}:${AWS::AccountId}:alerts'

Outputs:
  PrimaryEndpoint:
    Value: !GetAtt DBInstance.Endpoint.Address
    Description: Primary DB endpoint
  PrimaryPort:
    Value: !GetAtt DBInstance.Endpoint.Port
    Description: Primary DB port
  ReadReplicaEndpoint:
    Value: !GetAtt ReadReplica.Endpoint.Address
    Description: Read replica endpoint
```

### 10.2 Building with CDK (TypeScript)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cw_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface RdsStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  appSecurityGroup: ec2.ISecurityGroup;
}

export class RdsStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly readReplica: rds.DatabaseInstanceReadReplica;

  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    // KMS Key
    const encryptionKey = new kms.Key(this, 'RdsKey', {
      description: 'RDS encryption key',
      enableKeyRotation: true,
    });

    // Security Group
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: props.vpc,
      description: 'RDS MySQL Security Group',
      allowAllOutbound: false,
    });
    dbSg.addIngressRule(
      props.appSecurityGroup,
      ec2.Port.tcp(3306),
      'MySQL from app layer'
    );

    // Parameter Group
    const parameterGroup = new rds.ParameterGroup(this, 'Params', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),
      parameters: {
        character_set_server: 'utf8mb4',
        collation_server: 'utf8mb4_unicode_ci',
        slow_query_log: '1',
        long_query_time: '1',
        require_secure_transport: '1',
      },
    });

    // Primary Instance
    this.dbInstance = new rds.DatabaseInstance(this, 'Primary', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_35,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.R6G,
        ec2.InstanceSize.LARGE
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      multiAz: true,
      allocatedStorage: 100,
      maxAllocatedStorage: 500,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      storageEncryptionKey: encryptionKey,
      parameterGroup,
      backupRetention: cdk.Duration.days(7),
      preferredBackupWindow: '03:00-04:00',
      preferredMaintenanceWindow: 'Mon:04:00-Mon:05:00',
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      copyTagsToSnapshot: true,
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_25,
      monitoringInterval: cdk.Duration.seconds(60),
      cloudwatchLogsExports: ['audit', 'error', 'slowquery'],
      credentials: rds.Credentials.fromGeneratedSecret('admin', {
        secretName: 'rds/mysql/prod/credentials',
      }),
    });

    // Read Replica
    this.readReplica = new rds.DatabaseInstanceReadReplica(this, 'ReadReplica', {
      sourceDatabaseInstance: this.dbInstance,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.R6G,
        ec2.InstanceSize.LARGE
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      storageType: rds.StorageType.GP3,
      enablePerformanceInsights: true,
      performanceInsightRetention: rds.PerformanceInsightRetention.MONTHS_25,
      monitoringInterval: cdk.Duration.seconds(60),
    });

    // CPU Utilization Alarm
    const alertTopic = sns.Topic.fromTopicArn(
      this, 'AlertTopic',
      `arn:aws:sns:${this.region}:${this.account}:alerts`
    );

    const cpuAlarm = this.dbInstance.metricCPUUtilization({
      period: cdk.Duration.minutes(5),
    }).createAlarm(this, 'CpuAlarm', {
      threshold: 80,
      evaluationPeriods: 3,
      alarmDescription: 'RDS CPU utilization > 80%',
    });
    cpuAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // Replication Lag Alarm
    const replicaLagAlarm = new cloudwatch.Alarm(this, 'ReplicaLagAlarm', {
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'ReplicaLag',
        dimensionsMap: {
          DBInstanceIdentifier: this.readReplica.instanceIdentifier,
        },
        period: cdk.Duration.minutes(1),
        statistic: 'Average',
      }),
      threshold: 30,
      evaluationPeriods: 3,
      alarmDescription: 'RDS ReplicaLag > 30 seconds',
    });
    replicaLagAlarm.addAlarmAction(new cw_actions.SnsAction(alertTopic));

    // Outputs
    new cdk.CfnOutput(this, 'PrimaryEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'ReadReplicaEndpoint', {
      value: this.readReplica.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.dbInstance.secret!.secretArn,
    });
  }
}
```

---

## 11. Anti-Patterns

### 1. Running with Public Access Enabled

```
[BAD] Public access enabled
=============================================
Internet --> RDS (publicly_accessible=true)
  - Becomes a target for port scanning
  - Immediately compromised if SG misconfigured

[GOOD] Private subnet placement
=============================================
Internet --> ALB --> App (Private) --> RDS (Private)
  - RDS accessible only from within VPC
  - Developers access via Bastion / SSM
```

**Problem**: Setting `publicly_accessible = true` makes the RDS instance directly accessible from the internet. Even with security group restrictions, the risk of misconfiguration always exists.

**Solution**: Always place RDS in a private subnet and set `publicly_accessible = false`. Developer access should be through SSM Session Manager or a Bastion Host.

### 2. Running Production in a Single AZ

**Problem**: Disabling Multi-AZ to reduce costs means the database completely stops during an AZ failure. Manual recovery can take several hours.

**Solution**: Always set `multi_az = true` for production environments. The cost of Multi-AZ (~2x) is justified compared to the business impact of downtime. Single AZ is fine for development and staging environments.

### 3. Setting Backup Retention Period to 0

**Problem**: Setting the backup retention period to 0 disables automatic backups, making PITR (Point-in-Time Recovery) unavailable. Recovery from data corruption caused by accidental operations or application bugs becomes extremely difficult.

**Solution**: Set the backup retention period to at least 7 days for production, and 14-35 days for critical systems. Additionally, take regular manual snapshots and copy them to another region.

### 4. Continuing to Use the Default Parameter Group

**Problem**: The default parameter group cannot be customized, leaving no room for tuning. Character encoding settings and slow query logging remain disabled.

**Solution**: Always create a custom parameter group and properly configure character encoding (utf8mb4), slow query logging, InnoDB buffer pool size, and other settings.

### 5. Managing Passwords Without Secrets Manager

```
# Bad examples
- Hardcoding passwords in environment variables
- Storing in plaintext in .env files
- Left in Terraform state files

# Good examples
- Managing passwords with Secrets Manager
- Using IAM authentication
- IAM authentication via RDS Proxy
```

---

## 12. FAQ

### Q1: Should I choose RDS or Aurora?

**A**: Here are the decision criteria:
- **Choose RDS when**: You want to keep costs down, you're migrating from existing MySQL/PostgreSQL and expect identical behavior, or you have simple requirements.
- **Choose Aurora when**: You need high read throughput (up to 15 read replicas), you need automatic storage scaling, or you need faster failover (under 30 seconds).
- Aurora claims 3-5x the performance of RDS, but costs are also higher, so make your decision based on your workload.

### Q2: How do I handle replication lag issues with read replicas?

**A**: Combine the following strategies:
1. **Read immediately after write** from the primary (Read-after-Write consistency)
2. **Monitor replica lag** using the CloudWatch `ReplicaLag` metric and alert when thresholds are exceeded
3. **Scale up the instance class** to increase the replica's processing capacity
4. **Enable parallel replication** (MySQL: `replica_parallel_workers`)
5. **Use RDS Proxy** reader endpoints for load balancing

### Q3: How can I optimize RDS costs?

**A**: Key optimization techniques:
- **Reserved Instances**: Up to 60% discount with 1-year/3-year reservations
- **Right-sizing instances**: Check actual utilization with Performance Insights and eliminate over-provisioning
- **Storage type review**: Migrate from gp2 to gp3 for the same IOPS at lower cost
- **Stopping dev environments**: Stop unnecessary instances during nights and weekends (up to 7 days)
- **Graviton instances**: Switch to db.r6g/r7g for ~20% cost reduction

### Q4: Does downtime occur during the RDS maintenance window?

**A**: It depends on the type of maintenance:
- **Minor version upgrades**: A few minutes of downtime. With Multi-AZ, the Standby is updated first, then failover occurs, so downtime is only the failover duration (60-120 seconds).
- **Patch application**: Usually no downtime. Some OS patches may require a reboot.
- **Major version upgrades**: May cause tens of minutes of downtime. Blue/Green Deployments are recommended.

### Q5: What is RDS Blue/Green Deployment?

**A**: A feature for safely performing RDS major version upgrades and parameter changes. It creates a copy (Green) of the current environment (Blue), applies changes to the Green side for testing. If there are no issues, DNS is switched to make Green the production environment. The switchover completes in under 1 minute.

```bash
# Create a Blue/Green Deployment
aws rds create-blue-green-deployment \
  --blue-green-deployment-name mysql-upgrade \
  --source arn:aws:rds:ap-northeast-1:123456789012:db:my-mysql-db \
  --target-engine-version 8.0.36 \
  --target-db-parameter-group-name new-params

# Check status
aws rds describe-blue-green-deployments \
  --blue-green-deployment-identifier bgd-xxx

# Execute switchover
aws rds switchover-blue-green-deployment \
  --blue-green-deployment-identifier bgd-xxx \
  --switchover-timeout 300
```

---


## FAQ

### Q1: What is the most important point when learning this topic?

Gaining practical experience is the most important thing. Understanding deepens not just through theory, but by actually writing code and verifying how things work.

### Q2: What common mistakes do beginners make?

Skipping the fundamentals and jumping to advanced topics. We recommend thoroughly understanding the basic concepts explained in this guide before moving on to the next step.

### Q3: How is this knowledge applied in practice?

Knowledge of this topic is frequently used in everyday development work. It becomes especially important during code reviews and architecture design.

---

## 13. Summary

| Item | Key Points |
|---|---|
| What is RDS | Fully managed RDB service. Automates patching, backup, and failover |
| Engine selection | Web apps -> MySQL, analytics/extensibility -> PostgreSQL, high performance -> Aurora |
| Instance class | Graviton (r6g/r7g) offers the best value. t3 is for dev/test |
| Storage | gp3 is the standard. Use io2 for high IOPS requirements |
| Multi-AZ | Essential for production. Synchronous replication with automatic failover |
| Read replicas | Distribute read load. Note replication lag due to asynchronous replication |
| RDS Proxy | Optimizes Lambda and short-lived connections, speeds up failover |
| Backup | Minimize RPO with automatic backups + point-in-time recovery |
| Monitoring | Analyze wait events with Performance Insights, monitor metrics with CloudWatch |
| Security | Private subnet placement, encryption, IAM authentication |
| IaC | Declarative management with CloudFormation / CDK |

## Recommended Next Reads

- [DynamoDB](./01-dynamodb.md) — NoSQL database design and operations
- [ElastiCache](./02-elasticache.md) — Building a cache layer
- [VPC Fundamentals](../04-networking/00-vpc-basics.md) — Network design for RDS placement

## References

1. **AWS Official Documentation**: [Amazon RDS User Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/) — Detailed configuration reference by engine
2. **AWS Well-Architected Framework**: [Reliability Pillar - Database Design](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/) — Database design guidelines in the reliability pillar
3. **Amazon RDS Best Practices**: [Analyzing DB Load with Performance Insights](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PerfInsights.html) — Practical guide for performance analysis
4. **RDS Proxy Documentation**: [Using Amazon RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html) — Optimizing connection management
5. **RDS Blue/Green Deployments**: [Overview of Blue/Green Deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/blue-green-deployments.html) — Safe upgrade methods
