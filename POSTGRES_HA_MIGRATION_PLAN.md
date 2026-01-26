# PostgreSQL High Availability Migration Plan

**Date:** 2026-01-23
**Version:** 1.0
**Priority:** CRITICAL
**Target:** 10,000+ DAU Production Environment

---

## Executive Summary

This plan outlines the migration from a single PostgreSQL instance to a High Availability (HA) configuration. The current single-database architecture is a **critical single point of failure** that could cause complete system outage affecting all users.

### Current State: UNACCEPTABLE for 10K DAU
### Target State: HA with automatic failover < 60 seconds

---

## Problem Statement

### Current Architecture

```
┌─────────────────────┐
│   Application       │
│   (Multiple Pods)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Single PostgreSQL  │ ◄── SINGLE POINT OF FAILURE
│  Instance           │
└─────────────────────┘
```

### Risks

| Risk | Probability | Impact | Risk Score |
|------|-------------|--------|------------|
| Database server crash | Medium | Complete outage | **CRITICAL** |
| Disk failure | Low-Medium | Data loss possible | **CRITICAL** |
| Maintenance windows | Certain | Planned downtime | **HIGH** |
| Network partition | Low | Service interruption | **HIGH** |
| Resource exhaustion | Medium | Degraded performance | **MEDIUM** |

---

## Target Architecture

### HA Configuration

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Pod 1   │  │ Pod 2   │  │ Pod 3   │  │ Pod N   │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       └───────────┬┴───────────┴────────────┘               │
│                   │                                          │
│           ┌───────▼───────┐                                 │
│           │   PgBouncer   │  (Connection Pooling)           │
│           │   Pool        │                                 │
│           └───────┬───────┘                                 │
└───────────────────┼─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
┌───────▼──────┐   │    ┌──────▼───────┐
│  PostgreSQL  │   │    │  PostgreSQL  │
│  PRIMARY     │◄──┼───►│  STANDBY     │
│  (Read/Write)│   │    │  (Read-only) │
└──────────────┘   │    └──────────────┘
        │          │           │
        └──────────┼───────────┘
                   │
           Synchronous or
           Async Replication
```

---

## Option 1: AWS RDS PostgreSQL Multi-AZ (RECOMMENDED)

### Overview

AWS RDS Multi-AZ provides automatic failover, backups, and managed replication.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Region                               │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │     Availability Zone A  │  │     Availability Zone B      │  │
│  │  ┌───────────────────┐  │  │  ┌───────────────────────┐  │  │
│  │  │  RDS PostgreSQL   │  │  │  │  RDS PostgreSQL       │  │  │
│  │  │  PRIMARY          │◄─┼──┼─►│  STANDBY (Sync)       │  │  │
│  │  │  (Read/Write)     │  │  │  │  (Auto-promote)       │  │  │
│  │  └───────────────────┘  │  │  └───────────────────────┘  │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     RDS Endpoint                           │  │
│  │  Primary: freight-db.xxxx.rds.amazonaws.com:5432          │  │
│  │  Reader:  freight-db-ro.xxxx.rds.amazonaws.com:5432       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Terraform Configuration

```hcl
# main.tf - AWS RDS PostgreSQL Multi-AZ

# VPC Security Group for RDS
resource "aws_security_group" "rds" {
  name_prefix = "freight-rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "freight-rds-sg"
    Environment = var.environment
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "freight-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "freight-db-subnet-group"
    Environment = var.environment
  }
}

# Parameter Group with optimized settings
resource "aws_db_parameter_group" "postgres" {
  family = "postgres15"
  name   = "freight-postgres15-params"

  # Connection settings
  parameter {
    name  = "max_connections"
    value = "400"
  }

  # Performance settings
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "work_mem"
    value = "65536"  # 64MB
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "524288"  # 512MB
  }

  # WAL settings for replication
  parameter {
    name  = "wal_buffers"
    value = "16384"  # 16MB
  }

  parameter {
    name  = "checkpoint_completion_target"
    value = "0.9"
  }

  # Query timeout
  parameter {
    name  = "statement_timeout"
    value = "30000"  # 30 seconds
  }

  # Logging
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"  # Log queries > 1s
  }

  tags = {
    Name        = "freight-postgres-params"
    Environment = var.environment
  }
}

# RDS PostgreSQL Instance (Multi-AZ)
resource "aws_db_instance" "postgres" {
  identifier = "freight-production-db"

  # Engine
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = var.db_instance_class  # "db.r6g.large" recommended
  allocated_storage    = 100
  max_allocated_storage = 500  # Auto-scaling
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id           = var.kms_key_arn

  # Database
  db_name  = "freight"
  username = "freight_admin"
  password = var.db_password  # Use AWS Secrets Manager
  port     = 5432

  # HIGH AVAILABILITY
  multi_az = true  # ← CRITICAL: Enables Multi-AZ

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # Parameters
  parameter_group_name = aws_db_parameter_group.postgres.name

  # Backup
  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"
  skip_final_snapshot     = false
  final_snapshot_identifier = "freight-db-final-${timestamp()}"

  # Monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  # Deletion protection
  deletion_protection = true

  tags = {
    Name        = "freight-production-db"
    Environment = var.environment
    HA          = "multi-az"
  }
}

# Read Replica (Optional - for read scaling)
resource "aws_db_instance" "postgres_replica" {
  count = var.create_read_replica ? 1 : 0

  identifier          = "freight-production-db-replica"
  replicate_source_db = aws_db_instance.postgres.identifier
  instance_class      = var.db_replica_instance_class
  storage_encrypted   = true

  # Replica in different AZ
  availability_zone = var.replica_az

  # No Multi-AZ for replica (it's already a replica)
  multi_az = false

  # Performance
  performance_insights_enabled = true

  tags = {
    Name        = "freight-production-db-replica"
    Environment = var.environment
    Role        = "read-replica"
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_monitoring" {
  name = "freight-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "db_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "RDS instance endpoint"
}

output "db_reader_endpoint" {
  value       = var.create_read_replica ? aws_db_instance.postgres_replica[0].endpoint : null
  description = "Read replica endpoint"
}
```

### Variables File

```hcl
# variables.tf

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS"
  type        = list(string)
}

variable "app_security_group_id" {
  description = "Security group ID of application servers"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"  # 2 vCPU, 16GB RAM
}

variable "db_replica_instance_class" {
  description = "Read replica instance class"
  type        = string
  default     = "db.r6g.medium"
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

variable "create_read_replica" {
  description = "Create read replica"
  type        = bool
  default     = false
}

variable "replica_az" {
  description = "Availability zone for replica"
  type        = string
  default     = "us-east-1c"
}
```

### AWS CLI Quick Setup

```bash
#!/bin/bash
# quick-rds-setup.sh - For rapid deployment

# Variables
DB_IDENTIFIER="freight-production-db"
DB_NAME="freight"
DB_USERNAME="freight_admin"
DB_PASSWORD="$(aws secretsmanager get-random-password --password-length 32 --query RandomPassword --output text)"
INSTANCE_CLASS="db.r6g.large"
SUBNET_GROUP="freight-db-subnet-group"
SECURITY_GROUP_ID="sg-xxxxxxxx"

# Create DB instance with Multi-AZ
aws rds create-db-instance \
  --db-instance-identifier $DB_IDENTIFIER \
  --db-instance-class $INSTANCE_CLASS \
  --engine postgres \
  --engine-version 15.4 \
  --master-username $DB_USERNAME \
  --master-user-password $DB_PASSWORD \
  --db-name $DB_NAME \
  --allocated-storage 100 \
  --max-allocated-storage 500 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --db-subnet-group-name $SUBNET_GROUP \
  --vpc-security-group-ids $SECURITY_GROUP_ID \
  --backup-retention-period 7 \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --enable-cloudwatch-logs-exports postgresql upgrade \
  --deletion-protection \
  --tags Key=Environment,Value=production Key=HA,Value=multi-az

# Wait for instance to be available
aws rds wait db-instance-available --db-instance-identifier $DB_IDENTIFIER

# Store password in Secrets Manager
aws secretsmanager create-secret \
  --name "freight/production/db-password" \
  --secret-string "{\"username\":\"$DB_USERNAME\",\"password\":\"$DB_PASSWORD\"}"

echo "RDS Multi-AZ instance created successfully!"
echo "Endpoint: $(aws rds describe-db-instances --db-instance-identifier $DB_IDENTIFIER --query 'DBInstances[0].Endpoint.Address' --output text)"
```

### Cost Estimate (AWS)

| Component | Instance Type | Monthly Cost |
|-----------|---------------|--------------|
| RDS Multi-AZ Primary | db.r6g.large | ~$300 |
| Storage (100GB gp3) | - | ~$12 |
| Backup Storage | 7 days | ~$5 |
| Performance Insights | 7 days | Free |
| Data Transfer | ~50GB | ~$5 |
| **Total** | | **~$320-350/month** |

With Read Replica: Add ~$150/month

---

## Option 2: DigitalOcean Managed PostgreSQL

### Overview

DigitalOcean offers simpler setup with 3-node HA clusters at lower cost.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  DigitalOcean Managed Database               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL HA Cluster                   │   │
│  │                                                      │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │   │
│  │  │ Primary │  │ Standby │  │ Standby │            │   │
│  │  │ Node 1  │  │ Node 2  │  │ Node 3  │            │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘            │   │
│  │       │            │            │                  │   │
│  │       └────────────┼────────────┘                  │   │
│  │                    │                               │   │
│  │            Automatic Failover                      │   │
│  └────────────────────┼───────────────────────────────┘   │
│                       │                                    │
│  ┌────────────────────▼───────────────────────────────┐   │
│  │         Connection Pool (Built-in)                  │   │
│  │  Primary: db-xxxxx-do-user.db.ondigitalocean.com   │   │
│  │  Replica: db-xxxxx-do-user-replica.db.ondig...     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### CLI Setup

```bash
#!/bin/bash
# do-postgres-setup.sh

# Install doctl if not present
# brew install doctl (macOS) or snap install doctl (Linux)

# Authenticate
doctl auth init

# Create HA PostgreSQL cluster (3 nodes)
doctl databases create freight-production-db \
  --engine pg \
  --version 15 \
  --size db-s-2vcpu-4gb \
  --region nyc1 \
  --num-nodes 3 \
  --private-network-uuid $(doctl vpcs list --format ID --no-header)

# Wait for cluster to be ready
echo "Waiting for cluster to be ready..."
sleep 120

# Get connection details
doctl databases connection freight-production-db

# Create application database
doctl databases db create freight-production-db freight

# Create application user
doctl databases user create freight-production-db freight_app

# Enable connection pooling
doctl databases pool create freight-production-db freight-pool \
  --db freight \
  --user freight_app \
  --mode transaction \
  --size 25

# Configure firewall (allow only specific IPs/VPC)
doctl databases firewalls append freight-production-db \
  --rule type:k8s,value:$(doctl kubernetes cluster get freight-cluster --format ID --no-header)
```

### Terraform Configuration (DigitalOcean)

```hcl
# main.tf - DigitalOcean Managed PostgreSQL

terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

# VPC for private networking
resource "digitalocean_vpc" "main" {
  name     = "freight-vpc"
  region   = "nyc1"
  ip_range = "10.10.10.0/24"
}

# PostgreSQL HA Cluster (3 nodes)
resource "digitalocean_database_cluster" "postgres" {
  name       = "freight-production-db"
  engine     = "pg"
  version    = "15"
  size       = "db-s-2vcpu-4gb"  # 2 vCPU, 4GB RAM per node
  region     = "nyc1"
  node_count = 3  # HA: 1 primary + 2 standbys

  private_network_uuid = digitalocean_vpc.main.id

  maintenance_window {
    day  = "sunday"
    hour = "03:00:00"
  }
}

# Application database
resource "digitalocean_database_db" "freight" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "freight"
}

# Application user
resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "freight_app"
}

# Connection pool (PgBouncer)
resource "digitalocean_database_connection_pool" "main" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "freight-pool"
  mode       = "transaction"
  size       = 25
  db_name    = digitalocean_database_db.freight.name
  user       = digitalocean_database_user.app.name
}

# Read-only replica (optional)
resource "digitalocean_database_replica" "read_replica" {
  count      = var.create_read_replica ? 1 : 0
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "freight-read-replica"
  size       = "db-s-1vcpu-2gb"
  region     = "nyc1"
}

# Firewall rules
resource "digitalocean_database_firewall" "main" {
  cluster_id = digitalocean_database_cluster.postgres.id

  rule {
    type  = "k8s"
    value = var.kubernetes_cluster_id
  }

  # Allow from specific droplets
  dynamic "rule" {
    for_each = var.allowed_droplet_ids
    content {
      type  = "droplet"
      value = rule.value
    }
  }
}

# Outputs
output "db_host" {
  value = digitalocean_database_cluster.postgres.host
}

output "db_port" {
  value = digitalocean_database_cluster.postgres.port
}

output "db_private_host" {
  value = digitalocean_database_cluster.postgres.private_host
}

output "pool_host" {
  value = digitalocean_database_connection_pool.main.host
}

output "pool_port" {
  value = digitalocean_database_connection_pool.main.port
}
```

### Cost Estimate (DigitalOcean)

| Component | Size | Monthly Cost |
|-----------|------|--------------|
| HA Cluster (3 nodes) | db-s-2vcpu-4gb | ~$140 |
| Backup | Included | $0 |
| Read Replica (optional) | db-s-1vcpu-2gb | ~$25 |
| **Total** | | **~$140-165/month** |

---

## Option 3: Self-Hosted Patroni + etcd + HAProxy

### Overview

For maximum control, deploy Patroni-managed PostgreSQL with automatic failover.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                            │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      HAProxy Service                           │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                       │  │
│  │  │HAProxy 1│  │HAProxy 2│  │HAProxy 3│  (Health-checked)     │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘                       │  │
│  │       └───────────┬┴───────────┘                              │  │
│  └───────────────────┼───────────────────────────────────────────┘  │
│                      │                                               │
│  ┌───────────────────┼───────────────────────────────────────────┐  │
│  │                   │     Patroni Cluster                        │  │
│  │  ┌────────────────┼───────────────────────────────────────┐   │  │
│  │  │                ▼                                        │   │  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐           │   │  │
│  │  │  │   PostgreSQL 1   │  │   PostgreSQL 2   │           │   │  │
│  │  │  │   (PRIMARY)      │◄►│   (REPLICA)      │           │   │  │
│  │  │  │   + Patroni      │  │   + Patroni      │           │   │  │
│  │  │  └────────┬─────────┘  └────────┬─────────┘           │   │  │
│  │  │           │                      │                     │   │  │
│  │  │           └──────────┬───────────┘                     │   │  │
│  │  │                      │                                 │   │  │
│  │  │              ┌───────▼───────┐                        │   │  │
│  │  │              │    etcd       │  (Leader election)     │   │  │
│  │  │              │   Cluster     │                        │   │  │
│  │  │              └───────────────┘                        │   │  │
│  │  └────────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Kubernetes Manifests

```yaml
# patroni-postgresql.yaml

---
# etcd StatefulSet (for leader election)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: etcd
  namespace: database
spec:
  serviceName: etcd
  replicas: 3
  selector:
    matchLabels:
      app: etcd
  template:
    metadata:
      labels:
        app: etcd
    spec:
      containers:
      - name: etcd
        image: quay.io/coreos/etcd:v3.5.9
        ports:
        - containerPort: 2379
          name: client
        - containerPort: 2380
          name: peer
        env:
        - name: ETCD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: ETCD_INITIAL_ADVERTISE_PEER_URLS
          value: "http://$(ETCD_NAME).etcd:2380"
        - name: ETCD_LISTEN_PEER_URLS
          value: "http://0.0.0.0:2380"
        - name: ETCD_LISTEN_CLIENT_URLS
          value: "http://0.0.0.0:2379"
        - name: ETCD_ADVERTISE_CLIENT_URLS
          value: "http://$(ETCD_NAME).etcd:2379"
        - name: ETCD_INITIAL_CLUSTER
          value: "etcd-0=http://etcd-0.etcd:2380,etcd-1=http://etcd-1.etcd:2380,etcd-2=http://etcd-2.etcd:2380"
        - name: ETCD_INITIAL_CLUSTER_STATE
          value: "new"
        volumeMounts:
        - name: etcd-data
          mountPath: /var/run/etcd
  volumeClaimTemplates:
  - metadata:
      name: etcd-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 2Gi

---
# etcd Service
apiVersion: v1
kind: Service
metadata:
  name: etcd
  namespace: database
spec:
  clusterIP: None
  ports:
  - port: 2379
    name: client
  - port: 2380
    name: peer
  selector:
    app: etcd

---
# Patroni ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: patroni-config
  namespace: database
data:
  patroni.yml: |
    scope: freight-cluster
    namespace: /db/
    name: ${HOSTNAME}

    restapi:
      listen: 0.0.0.0:8008
      connect_address: ${HOSTNAME}.patroni:8008

    etcd3:
      hosts: etcd-0.etcd:2379,etcd-1.etcd:2379,etcd-2.etcd:2379

    bootstrap:
      dcs:
        ttl: 30
        loop_wait: 10
        retry_timeout: 10
        maximum_lag_on_failover: 1048576
        postgresql:
          use_pg_rewind: true
          use_slots: true
          parameters:
            max_connections: 400
            shared_buffers: 2GB
            effective_cache_size: 6GB
            work_mem: 64MB
            maintenance_work_mem: 512MB
            wal_level: replica
            max_wal_senders: 5
            max_replication_slots: 5
            hot_standby: "on"
            wal_log_hints: "on"
            statement_timeout: 30000

      initdb:
        - encoding: UTF8
        - data-checksums

      pg_hba:
        - host replication replicator 0.0.0.0/0 md5
        - host all all 0.0.0.0/0 md5

    postgresql:
      listen: 0.0.0.0:5432
      connect_address: ${HOSTNAME}.patroni:5432
      data_dir: /home/postgres/pgdata
      pgpass: /tmp/pgpass
      authentication:
        replication:
          username: replicator
          password: ${REPLICATION_PASSWORD}
        superuser:
          username: postgres
          password: ${POSTGRES_PASSWORD}
      parameters:
        unix_socket_directories: '/var/run/postgresql'

    tags:
      nofailover: false
      noloadbalance: false
      clonefrom: false
      nosync: false

---
# Patroni StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: patroni
  namespace: database
spec:
  serviceName: patroni
  replicas: 2
  selector:
    matchLabels:
      app: patroni
  template:
    metadata:
      labels:
        app: patroni
    spec:
      serviceAccountName: patroni
      securityContext:
        fsGroup: 999
      containers:
      - name: patroni
        image: registry.opensource.zalan.do/acid/spilo-15:3.0-p1
        ports:
        - containerPort: 5432
          name: postgresql
        - containerPort: 8008
          name: patroni
        env:
        - name: PGDATA
          value: /home/postgres/pgdata
        - name: PGPASSWORD_SUPERUSER
          valueFrom:
            secretKeyRef:
              name: patroni-secrets
              key: postgres-password
        - name: PGPASSWORD_REPLICATION
          valueFrom:
            secretKeyRef:
              name: patroni-secrets
              key: replication-password
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: patroni-secrets
              key: postgres-password
        - name: REPLICATION_PASSWORD
          valueFrom:
            secretKeyRef:
              name: patroni-secrets
              key: replication-password
        - name: SCOPE
          value: freight-cluster
        - name: KUBERNETES_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: POD_IP
          valueFrom:
            fieldRef:
              fieldPath: status.podIP
        volumeMounts:
        - name: pgdata
          mountPath: /home/postgres/pgdata
        - name: patroni-config
          mountPath: /home/postgres/patroni.yml
          subPath: patroni.yml
        resources:
          requests:
            cpu: "1"
            memory: "4Gi"
          limits:
            cpu: "2"
            memory: "8Gi"
        livenessProbe:
          httpGet:
            path: /liveness
            port: 8008
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readiness
            port: 8008
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: patroni-config
        configMap:
          name: patroni-config
  volumeClaimTemplates:
  - metadata:
      name: pgdata
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi

---
# Patroni Service (headless)
apiVersion: v1
kind: Service
metadata:
  name: patroni
  namespace: database
spec:
  clusterIP: None
  ports:
  - port: 5432
    name: postgresql
  - port: 8008
    name: patroni
  selector:
    app: patroni

---
# Patroni Primary Service (for writes)
apiVersion: v1
kind: Service
metadata:
  name: patroni-primary
  namespace: database
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: patroni
    role: master

---
# Patroni Replica Service (for reads)
apiVersion: v1
kind: Service
metadata:
  name: patroni-replica
  namespace: database
spec:
  type: ClusterIP
  ports:
  - port: 5432
    targetPort: 5432
  selector:
    app: patroni
    role: replica

---
# Secrets
apiVersion: v1
kind: Secret
metadata:
  name: patroni-secrets
  namespace: database
type: Opaque
stringData:
  postgres-password: "CHANGE_ME_STRONG_PASSWORD"
  replication-password: "CHANGE_ME_REPLICATION_PASSWORD"
```

---

## Application Configuration Updates

### Environment Variables

```bash
# .env.production

# Primary connection (writes)
DATABASE_URL="postgresql://freight_app:PASSWORD@db-primary.freight.com:5432/freight?sslmode=require"

# Read replica connection (reads)
DATABASE_READ_URL="postgresql://freight_app:PASSWORD@db-replica.freight.com:5432/freight?sslmode=require"

# Connection pooling
PGBOUNCER_ENABLED=true
DB_POOL_MIN=2
DB_POOL_MAX=10

# Timeouts
DB_STATEMENT_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

### Prisma Configuration for Read Replicas

```typescript
// lib/db-with-replicas.ts

import { PrismaClient } from '@prisma/client';

// Primary client (writes)
const primaryClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Replica client (reads)
const replicaClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL || process.env.DATABASE_URL,
    },
  },
});

/**
 * Get appropriate client based on operation type
 */
export function getDbClient(readOnly: boolean = false): PrismaClient {
  if (readOnly && process.env.DATABASE_READ_URL) {
    return replicaClient;
  }
  return primaryClient;
}

// Export for convenience
export const db = primaryClient;
export const dbRead = replicaClient;
```

---

## Failover Testing Procedure

### Test 1: Simulated Primary Failure

```bash
#!/bin/bash
# test-failover.sh

echo "=== PostgreSQL HA Failover Test ==="
echo "Starting at $(date)"

# 1. Check current primary
echo "Step 1: Checking current primary..."
PRIMARY_BEFORE=$(psql $DATABASE_URL -t -c "SELECT pg_is_in_recovery();")
echo "Is current connection to replica? $PRIMARY_BEFORE"

# 2. Record current state
echo "Step 2: Recording baseline..."
WRITE_TEST_ID=$(psql $DATABASE_URL -t -c "INSERT INTO health_checks (status) VALUES ('pre-failover') RETURNING id;")
echo "Inserted test record: $WRITE_TEST_ID"

# 3. Trigger failover (AWS RDS)
echo "Step 3: Triggering failover..."
aws rds reboot-db-instance \
  --db-instance-identifier freight-production-db \
  --force-failover

# 4. Monitor failover
echo "Step 4: Monitoring failover..."
START_TIME=$(date +%s)
MAX_WAIT=300  # 5 minutes

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ $ELAPSED -gt $MAX_WAIT ]; then
    echo "FAIL: Failover exceeded $MAX_WAIT seconds"
    exit 1
  fi

  # Try to connect and write
  if psql $DATABASE_URL -c "SELECT 1" 2>/dev/null; then
    RECOVERY_TIME=$ELAPSED
    break
  fi

  echo "Waiting... ($ELAPSED seconds elapsed)"
  sleep 5
done

# 5. Verify data integrity
echo "Step 5: Verifying data integrity..."
VERIFY=$(psql $DATABASE_URL -t -c "SELECT id FROM health_checks WHERE id = $WRITE_TEST_ID;")

if [ "$VERIFY" = "$WRITE_TEST_ID" ]; then
  echo "SUCCESS: Data integrity verified"
else
  echo "FAIL: Data integrity check failed"
  exit 1
fi

# 6. Test write capability
echo "Step 6: Testing write capability..."
psql $DATABASE_URL -c "INSERT INTO health_checks (status) VALUES ('post-failover');"

if [ $? -eq 0 ]; then
  echo "SUCCESS: Write capability confirmed"
else
  echo "FAIL: Unable to write after failover"
  exit 1
fi

# 7. Report
echo ""
echo "=== Failover Test Results ==="
echo "Recovery Time: $RECOVERY_TIME seconds"
echo "Data Integrity: PASSED"
echo "Write Capability: PASSED"
echo "Test completed at $(date)"
```

### Test 2: Application Connection Test

```typescript
// scripts/test-db-failover.ts

import { db, checkDatabaseHealth } from '../lib/db';

async function testFailoverRecovery() {
  console.log('Starting failover recovery test...');

  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes at 5s intervals

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const health = await checkDatabaseHealth();

      if (health.healthy) {
        const recoveryTime = (Date.now() - startTime) / 1000;
        console.log(`Database recovered after ${recoveryTime}s (${attempts} attempts)`);

        // Verify write capability
        const result = await db.$executeRaw`
          INSERT INTO health_checks (status, created_at)
          VALUES ('failover-test', NOW())
        `;

        console.log('Write test passed');
        return {
          success: true,
          recoveryTimeSeconds: recoveryTime,
          attempts,
        };
      }
    } catch (error) {
      console.log(`Attempt ${attempts}: ${error.message}`);
    }

    await new Promise((r) => setTimeout(r, 5000)); // Wait 5s
  }

  return {
    success: false,
    message: 'Failover recovery timeout',
  };
}

testFailoverRecovery()
  .then(console.log)
  .catch(console.error);
```

---

## Migration Checklist

### Pre-Migration

- [ ] Backup current database (pg_dump)
- [ ] Document current DATABASE_URL
- [ ] Notify team of maintenance window
- [ ] Prepare rollback procedure
- [ ] Test restore from backup

### Migration Steps

- [ ] Create HA database cluster
- [ ] Configure security groups/firewall
- [ ] Set up connection pooling (PgBouncer)
- [ ] Migrate data (pg_dump / pg_restore)
- [ ] Update DNS / connection strings
- [ ] Update application environment variables
- [ ] Deploy application with new config
- [ ] Verify connectivity and performance

### Post-Migration

- [ ] Run failover test
- [ ] Verify all application features
- [ ] Monitor for 24 hours
- [ ] Document new architecture
- [ ] Update runbooks

---

## Cost Comparison

| Provider | Configuration | Monthly Cost | RTO | Features |
|----------|---------------|--------------|-----|----------|
| **AWS RDS Multi-AZ** | db.r6g.large, 100GB | ~$350 | <60s | Managed, PI, Auto-backup |
| **DigitalOcean** | 3-node HA, 4GB | ~$140 | <60s | Managed, Simple |
| **Self-Hosted (Patroni)** | 2x 4GB VMs | ~$80 + labor | <30s | Full control |

### Recommendation

For **10K DAU production**:
- **Primary**: AWS RDS Multi-AZ (best reliability, managed)
- **Alternative**: DigitalOcean (cost-effective, simpler)
- **Advanced**: Patroni (if you have DevOps expertise)

---

## Timeline

| Week | Task | Duration |
|------|------|----------|
| 1 | Provision HA cluster | 1-2 days |
| 1 | Configure security & networking | 1 day |
| 1 | Set up monitoring | 1 day |
| 2 | Data migration (staging) | 1-2 days |
| 2 | Application testing | 2-3 days |
| 2 | Production migration | 1 day |
| 2 | Failover testing | 1 day |

**Total: 1-2 weeks**

---

**Report Generated:** 2026-01-23
**Version:** 1.0
**Status:** READY FOR IMPLEMENTATION
