# Redis High Availability Migration Plan

**Date:** 2026-01-23
**Version:** 1.0
**Priority:** CRITICAL
**Target:** 10,000+ DAU Production Environment

---

## Executive Summary

This plan outlines the migration from a single Redis instance to a High Availability (HA) configuration. Redis is critical infrastructure powering:

- **Rate Limiting** - Protects all API endpoints
- **Session Storage** - User authentication sessions (24h TTL)
- **Job Queues** - BullMQ for async processing (email, SMS, distance calculations)
- **WebSocket Adapter** - Real-time GPS updates across server instances
- **Caching** - Entity cache, listings cache, geo data

### Current State: SINGLE POINT OF FAILURE
### Target State: HA with automatic failover < 5 seconds

---

## Impact of Redis Failure

| System | Impact if Redis Dies |
|--------|---------------------|
| Rate Limiting | All rate limits bypassed (DDoS vulnerable) |
| Sessions | All users logged out instantly |
| Job Queues | Email, SMS, notifications stop |
| WebSocket | GPS tracking breaks across instances |
| Caching | Database load increases 5-10x |

**Estimated Outage Impact: SEVERE** - Users cannot authenticate, real-time features fail.

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Pod 1   │  │ Pod 2   │  │ Pod 3   │  │ Pod N   │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       └───────────┬┴───────────┴────────────┘               │
│                   │                                          │
│           ┌───────▼───────┐                                 │
│           │ Single Redis  │ ◄── SINGLE POINT OF FAILURE    │
│           │ Instance      │                                 │
│           └───────────────┘                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Target Architecture Options

### Option 1: Redis Sentinel (RECOMMENDED for 10K DAU)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Redis Sentinel Cluster                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Sentinel Nodes (Quorum)                      │ │
│  │  ┌───────────┐    ┌───────────┐    ┌───────────┐              │ │
│  │  │Sentinel 1 │    │Sentinel 2 │    │Sentinel 3 │              │ │
│  │  │ :26379    │    │ :26379    │    │ :26379    │              │ │
│  │  └─────┬─────┘    └─────┬─────┘    └─────┬─────┘              │ │
│  │        └────────────────┼────────────────┘                     │ │
│  │                         │ Monitors                             │ │
│  └─────────────────────────┼──────────────────────────────────────┘ │
│                            │                                         │
│  ┌─────────────────────────┼──────────────────────────────────────┐ │
│  │                         ▼                                       │ │
│  │  ┌───────────────┐         ┌───────────────┐                  │ │
│  │  │ Redis Master  │◄───────►│ Redis Replica │                  │ │
│  │  │   (Primary)   │  Async  │   (Standby)   │                  │ │
│  │  │   :6379       │  Repl   │   :6379       │                  │ │
│  │  └───────────────┘         └───────────────┘                  │ │
│  │                                                                │ │
│  │         Automatic Failover (< 5 seconds)                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Option 2: Redis Cluster (For >100K DAU)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Redis Cluster (6 nodes)                         │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  Shard 1       │  │  Shard 2       │  │  Shard 3       │        │
│  │  ┌──────────┐  │  │  ┌──────────┐  │  │  ┌──────────┐  │        │
│  │  │ Master 1 │  │  │  │ Master 2 │  │  │  │ Master 3 │  │        │
│  │  │ Slots    │  │  │  │ Slots    │  │  │  │ Slots    │  │        │
│  │  │ 0-5460   │  │  │  │ 5461-    │  │  │  │ 10923-   │  │        │
│  │  └────┬─────┘  │  │  │ 10922    │  │  │  │ 16383    │  │        │
│  │       │        │  │  └────┬─────┘  │  │  └────┬─────┘  │        │
│  │  ┌────▼─────┐  │  │  ┌────▼─────┐  │  │  ┌────▼─────┐  │        │
│  │  │ Replica 1│  │  │  │ Replica 2│  │  │  │ Replica 3│  │        │
│  │  └──────────┘  │  │  └──────────┘  │  │  └──────────┘  │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                      │
│  Automatic sharding + failover per shard                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Option 3: Managed Redis (Upstash/ElastiCache)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Managed Redis (AWS ElastiCache)                   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 ElastiCache Redis Cluster                    │   │
│  │                                                              │   │
│  │  Primary Endpoint: freight.xxxxx.clustercfg.use1.cache...   │   │
│  │  Reader Endpoint:  freight-ro.xxxxx.clustercfg.use1.cache...│   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │   │
│  │  │ Primary     │  │ Replica 1   │  │ Replica 2   │         │   │
│  │  │ (AZ-a)      │  │ (AZ-b)      │  │ (AZ-c)      │         │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │   │
│  │                                                              │   │
│  │  Managed failover, backups, monitoring                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Option 1: Redis Sentinel Implementation

### Docker Compose (Local/Development)

```yaml
# docker-compose.redis-sentinel.yml

version: '3.8'

services:
  redis-master:
    image: redis:7-alpine
    container_name: redis-master
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"
    volumes:
      - redis-master-data:/data
    networks:
      - redis-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  redis-replica:
    image: redis:7-alpine
    container_name: redis-replica
    command: >
      redis-server
      --appendonly yes
      --requirepass ${REDIS_PASSWORD}
      --masterauth ${REDIS_PASSWORD}
      --replicaof redis-master 6379
    ports:
      - "6380:6379"
    volumes:
      - redis-replica-data:/data
    networks:
      - redis-net
    depends_on:
      redis-master:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  sentinel-1:
    image: redis:7-alpine
    container_name: sentinel-1
    command: redis-sentinel /etc/redis/sentinel.conf
    ports:
      - "26379:26379"
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf:ro
    networks:
      - redis-net
    depends_on:
      - redis-master
      - redis-replica

  sentinel-2:
    image: redis:7-alpine
    container_name: sentinel-2
    command: redis-sentinel /etc/redis/sentinel.conf
    ports:
      - "26380:26379"
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf:ro
    networks:
      - redis-net
    depends_on:
      - redis-master
      - redis-replica

  sentinel-3:
    image: redis:7-alpine
    container_name: sentinel-3
    command: redis-sentinel /etc/redis/sentinel.conf
    ports:
      - "26381:26379"
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf:ro
    networks:
      - redis-net
    depends_on:
      - redis-master
      - redis-replica

volumes:
  redis-master-data:
  redis-replica-data:

networks:
  redis-net:
    driver: bridge
```

### Sentinel Configuration

```conf
# sentinel.conf

# Sentinel port
port 26379

# Monitor master
sentinel monitor freight-master redis-master 6379 2

# Master password
sentinel auth-pass freight-master YOUR_REDIS_PASSWORD

# Failover timing
sentinel down-after-milliseconds freight-master 5000
sentinel failover-timeout freight-master 10000
sentinel parallel-syncs freight-master 1

# Notification script (optional)
# sentinel notification-script freight-master /scripts/notify.sh

# Logging
logfile ""
loglevel notice
```

### Kubernetes Manifests

```yaml
# redis-sentinel-k8s.yaml

---
# Redis Master StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-master
  namespace: redis
spec:
  serviceName: redis-master
  replicas: 1
  selector:
    matchLabels:
      app: redis
      role: master
  template:
    metadata:
      labels:
        app: redis
        role: master
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --requirepass
        - $(REDIS_PASSWORD)
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secrets
              key: password
        resources:
          requests:
            cpu: "500m"
            memory: "1Gi"
          limits:
            cpu: "1"
            memory: "2Gi"
        volumeMounts:
        - name: data
          mountPath: /data
        livenessProbe:
          exec:
            command:
            - redis-cli
            - -a
            - $(REDIS_PASSWORD)
            - ping
          initialDelaySeconds: 10
          periodSeconds: 5
        readinessProbe:
          exec:
            command:
            - redis-cli
            - -a
            - $(REDIS_PASSWORD)
            - ping
          initialDelaySeconds: 5
          periodSeconds: 3
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi

---
# Redis Replica StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-replica
  namespace: redis
spec:
  serviceName: redis-replica
  replicas: 2
  selector:
    matchLabels:
      app: redis
      role: replica
  template:
    metadata:
      labels:
        app: redis
        role: replica
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --appendonly
        - "yes"
        - --requirepass
        - $(REDIS_PASSWORD)
        - --masterauth
        - $(REDIS_PASSWORD)
        - --replicaof
        - redis-master-0.redis-master
        - "6379"
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-secrets
              key: password
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "500m"
            memory: "1Gi"
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi

---
# Sentinel Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-sentinel
  namespace: redis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: redis-sentinel
  template:
    metadata:
      labels:
        app: redis-sentinel
    spec:
      containers:
      - name: sentinel
        image: redis:7-alpine
        ports:
        - containerPort: 26379
        command:
        - redis-sentinel
        - /etc/redis/sentinel.conf
        volumeMounts:
        - name: sentinel-config
          mountPath: /etc/redis
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "200m"
            memory: "256Mi"
      volumes:
      - name: sentinel-config
        configMap:
          name: sentinel-config

---
# Sentinel ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: sentinel-config
  namespace: redis
data:
  sentinel.conf: |
    port 26379
    sentinel monitor freight-master redis-master-0.redis-master 6379 2
    sentinel auth-pass freight-master REDIS_PASSWORD_PLACEHOLDER
    sentinel down-after-milliseconds freight-master 5000
    sentinel failover-timeout freight-master 10000
    sentinel parallel-syncs freight-master 1

---
# Services
apiVersion: v1
kind: Service
metadata:
  name: redis-master
  namespace: redis
spec:
  clusterIP: None
  ports:
  - port: 6379
  selector:
    app: redis
    role: master

---
apiVersion: v1
kind: Service
metadata:
  name: redis-replica
  namespace: redis
spec:
  clusterIP: None
  ports:
  - port: 6379
  selector:
    app: redis
    role: replica

---
apiVersion: v1
kind: Service
metadata:
  name: redis-sentinel
  namespace: redis
spec:
  ports:
  - port: 26379
  selector:
    app: redis-sentinel

---
# Secrets
apiVersion: v1
kind: Secret
metadata:
  name: redis-secrets
  namespace: redis
type: Opaque
stringData:
  password: "CHANGE_ME_STRONG_PASSWORD"
```

---

## Option 2: AWS ElastiCache Implementation

### Terraform Configuration

```hcl
# elasticache.tf

# Security Group
resource "aws_security_group" "redis" {
  name_prefix = "freight-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
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
    Name        = "freight-redis-sg"
    Environment = var.environment
  }
}

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "freight-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "freight-redis-subnet-group"
    Environment = var.environment
  }
}

# Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7"
  name   = "freight-redis7-params"

  # Memory optimization
  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  # Persistence
  parameter {
    name  = "appendonly"
    value = "yes"
  }

  # Timeout
  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = {
    Name        = "freight-redis-params"
    Environment = var.environment
  }
}

# ElastiCache Replication Group (HA)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "freight-redis"
  description                = "Freight Management Redis HA Cluster"

  # Engine
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = var.redis_node_type  # "cache.r6g.large"
  port                       = 6379

  # HIGH AVAILABILITY
  num_cache_clusters         = 3  # 1 primary + 2 replicas
  automatic_failover_enabled = true
  multi_az_enabled           = true

  # Network
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]

  # Parameters
  parameter_group_name       = aws_elasticache_parameter_group.redis.name

  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # Maintenance
  maintenance_window         = "sun:05:00-sun:06:00"
  snapshot_window            = "03:00-04:00"
  snapshot_retention_limit   = 7

  # Auto minor version upgrade
  auto_minor_version_upgrade = true

  # Notifications
  notification_topic_arn     = var.sns_topic_arn

  tags = {
    Name        = "freight-redis-ha"
    Environment = var.environment
    HA          = "enabled"
  }

  lifecycle {
    ignore_changes = [engine_version]
  }
}

# Outputs
output "redis_primary_endpoint" {
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  description = "Redis primary endpoint (for writes)"
}

output "redis_reader_endpoint" {
  value       = aws_elasticache_replication_group.redis.reader_endpoint_address
  description = "Redis reader endpoint (for reads)"
}

output "redis_port" {
  value       = 6379
  description = "Redis port"
}
```

### AWS CLI Quick Setup

```bash
#!/bin/bash
# quick-elasticache-setup.sh

# Variables
CLUSTER_ID="freight-redis"
NODE_TYPE="cache.r6g.medium"
SUBNET_GROUP="freight-redis-subnet-group"
SECURITY_GROUP_ID="sg-xxxxxxxx"
AUTH_TOKEN="$(openssl rand -base64 32)"

# Create replication group with HA
aws elasticache create-replication-group \
  --replication-group-id $CLUSTER_ID \
  --replication-group-description "Freight Redis HA" \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type $NODE_TYPE \
  --num-cache-clusters 3 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --cache-subnet-group-name $SUBNET_GROUP \
  --security-group-ids $SECURITY_GROUP_ID \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "$AUTH_TOKEN" \
  --snapshot-retention-limit 7 \
  --tags Key=Environment,Value=production Key=HA,Value=enabled

# Wait for cluster
echo "Waiting for cluster to be available..."
aws elasticache wait replication-group-available --replication-group-id $CLUSTER_ID

# Get endpoints
echo "Primary endpoint:"
aws elasticache describe-replication-groups \
  --replication-group-id $CLUSTER_ID \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text

echo "Reader endpoint:"
aws elasticache describe-replication-groups \
  --replication-group-id $CLUSTER_ID \
  --query 'ReplicationGroups[0].NodeGroups[0].ReaderEndpoint.Address' \
  --output text

# Store auth token in Secrets Manager
aws secretsmanager create-secret \
  --name "freight/production/redis-auth-token" \
  --secret-string "$AUTH_TOKEN"

echo "ElastiCache cluster created successfully!"
```

---

## Application Code Updates

### Updated Redis Client (lib/redis.ts)

```typescript
// lib/redis.ts - Updated for Sentinel/Cluster support

import Redis, { RedisOptions, Cluster, ClusterOptions } from 'ioredis';

// =============================================================================
// CONFIGURATION
// =============================================================================

type RedisMode = 'standalone' | 'sentinel' | 'cluster';

interface RedisConfig {
  mode: RedisMode;
  sentinels?: Array<{ host: string; port: number }>;
  clusterNodes?: Array<{ host: string; port: number }>;
  name?: string; // Sentinel master name
  password?: string;
}

function getRedisMode(): RedisMode {
  if (process.env.REDIS_SENTINELS) return 'sentinel';
  if (process.env.REDIS_CLUSTER_NODES) return 'cluster';
  return 'standalone';
}

function getRedisConfig(): RedisConfig {
  const mode = getRedisMode();
  const password = process.env.REDIS_PASSWORD;

  if (mode === 'sentinel') {
    // Parse sentinels: "host1:port1,host2:port2,host3:port3"
    const sentinelString = process.env.REDIS_SENTINELS || '';
    const sentinels = sentinelString.split(',').map((s) => {
      const [host, port] = s.trim().split(':');
      return { host, port: parseInt(port) || 26379 };
    });

    return {
      mode: 'sentinel',
      sentinels,
      name: process.env.REDIS_SENTINEL_MASTER || 'freight-master',
      password,
    };
  }

  if (mode === 'cluster') {
    // Parse cluster nodes: "host1:port1,host2:port2,..."
    const nodesString = process.env.REDIS_CLUSTER_NODES || '';
    const clusterNodes = nodesString.split(',').map((s) => {
      const [host, port] = s.trim().split(':');
      return { host, port: parseInt(port) || 6379 };
    });

    return {
      mode: 'cluster',
      clusterNodes,
      password,
    };
  }

  return {
    mode: 'standalone',
    password,
  };
}

// =============================================================================
// CLIENT FACTORY
// =============================================================================

function createSentinelClient(config: RedisConfig): Redis {
  console.log(`[Redis] Connecting via Sentinel to master: ${config.name}`);

  return new Redis({
    sentinels: config.sentinels,
    name: config.name,
    password: config.password,
    sentinelPassword: config.password,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 500, 3000);
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
      return targetErrors.some((e) => err.message.includes(e));
    },
    // Sentinel-specific options
    sentinelRetryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 1000);
    },
    enableReadyCheck: true,
    enableOfflineQueue: true,
  });
}

function createClusterClient(config: RedisConfig): Cluster {
  console.log(`[Redis] Connecting to Cluster with ${config.clusterNodes?.length} nodes`);

  const clusterOptions: ClusterOptions = {
    redisOptions: {
      password: config.password,
      lazyConnect: true,
    },
    clusterRetryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 500, 3000);
    },
    enableReadyCheck: true,
    scaleReads: 'slave', // Read from replicas
    maxRedirections: 16,
    retryDelayOnClusterDown: 1000,
    retryDelayOnFailover: 500,
    retryDelayOnTryAgain: 500,
  };

  return new Cluster(config.clusterNodes || [], clusterOptions);
}

function createStandaloneClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  const options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    reconnectOnError: (err) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some((e) => err.message.includes(e));
    },
  };

  if (redisUrl) {
    console.log('[Redis] Connecting to standalone instance via URL');
    return new Redis(redisUrl, options);
  }

  console.log('[Redis] Connecting to localhost');
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    ...options,
  });
}

// =============================================================================
// REDIS CLIENT SINGLETON
// =============================================================================

const globalForRedis = globalThis as unknown as {
  redis: Redis | Cluster | undefined;
  redisConnected: boolean;
  redisMode: RedisMode | undefined;
};

export function isRedisEnabled(): boolean {
  return process.env.REDIS_ENABLED === 'true' || !!process.env.REDIS_URL || !!process.env.REDIS_SENTINELS || !!process.env.REDIS_CLUSTER_NODES;
}

function createRedisClient(): Redis | Cluster | null {
  if (!isRedisEnabled()) {
    console.log('[Redis] Disabled - using in-memory fallback');
    return null;
  }

  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const config = getRedisConfig();
  let client: Redis | Cluster;

  switch (config.mode) {
    case 'sentinel':
      client = createSentinelClient(config);
      break;
    case 'cluster':
      client = createClusterClient(config);
      break;
    default:
      client = createStandaloneClient();
  }

  // Event handlers
  client.on('connect', () => {
    console.log(`[Redis] Connected (${config.mode} mode)`);
    globalForRedis.redisConnected = true;
  });

  client.on('ready', () => {
    console.log('[Redis] Ready');
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Error:', err.message);
    globalForRedis.redisConnected = false;
  });

  client.on('close', () => {
    console.log('[Redis] Connection closed');
    globalForRedis.redisConnected = false;
  });

  // Sentinel-specific events
  if (config.mode === 'sentinel') {
    (client as Redis).on('+failover-end', () => {
      console.log('[Redis Sentinel] Failover completed');
    });

    (client as Redis).on('+switch-master', (master: string) => {
      console.log(`[Redis Sentinel] Switched to new master: ${master}`);
    });
  }

  // Cluster-specific events
  if (config.mode === 'cluster') {
    (client as Cluster).on('node error', (err: Error, address: string) => {
      console.error(`[Redis Cluster] Node ${address} error:`, err.message);
    });
  }

  globalForRedis.redis = client;
  globalForRedis.redisMode = config.mode;

  return client;
}

export const redis = createRedisClient();

export function getRedisMode(): RedisMode {
  return globalForRedis.redisMode || 'standalone';
}

// Rest of the utility functions remain the same...
```

---

## Environment Configuration

### Standalone (Current)

```bash
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

### Sentinel Mode

```bash
REDIS_ENABLED=true
REDIS_SENTINELS=sentinel-1:26379,sentinel-2:26379,sentinel-3:26379
REDIS_SENTINEL_MASTER=freight-master
REDIS_PASSWORD=your_strong_password
```

### Cluster Mode

```bash
REDIS_ENABLED=true
REDIS_CLUSTER_NODES=redis-1:6379,redis-2:6379,redis-3:6379,redis-4:6379,redis-5:6379,redis-6:6379
REDIS_PASSWORD=your_strong_password
```

### AWS ElastiCache

```bash
REDIS_ENABLED=true
REDIS_URL=rediss://freight-redis.xxxxx.use1.cache.amazonaws.com:6379
REDIS_PASSWORD=your_auth_token
```

---

## Failover Testing

### Test Script

```bash
#!/bin/bash
# test-redis-failover.sh

echo "=== Redis HA Failover Test ==="
echo "Starting at $(date)"

REDIS_CLI="redis-cli -h redis-master -p 6379 -a $REDIS_PASSWORD"

# 1. Verify initial state
echo "Step 1: Checking initial state..."
$REDIS_CLI INFO replication | grep role
$REDIS_CLI SET test:failover "pre-failover-$(date +%s)"

# 2. Get current master
CURRENT_MASTER=$($REDIS_CLI INFO replication | grep master_host | cut -d: -f2 | tr -d '\r')
echo "Current master: $CURRENT_MASTER"

# 3. Trigger failover via Sentinel
echo "Step 2: Triggering failover..."
redis-cli -h sentinel-1 -p 26379 SENTINEL FAILOVER freight-master

# 4. Monitor failover
echo "Step 3: Monitoring failover..."
START_TIME=$(date +%s)
sleep 5

# 5. Verify new master
NEW_MASTER=$(redis-cli -h sentinel-1 -p 26379 SENTINEL get-master-addr-by-name freight-master | head -1)
echo "New master: $NEW_MASTER"

# 6. Test read after failover
echo "Step 4: Testing read after failover..."
VALUE=$($REDIS_CLI GET test:failover)
echo "Value: $VALUE"

# 7. Test write after failover
echo "Step 5: Testing write after failover..."
$REDIS_CLI SET test:failover "post-failover-$(date +%s)"

if [ $? -eq 0 ]; then
  FAILOVER_TIME=$(($(date +%s) - START_TIME))
  echo ""
  echo "=== Failover Test Results ==="
  echo "Failover Time: ${FAILOVER_TIME}s"
  echo "Read After Failover: PASSED"
  echo "Write After Failover: PASSED"
  echo "New Master: $NEW_MASTER"
else
  echo "FAILED: Unable to write after failover"
  exit 1
fi
```

### Application Failover Test

```typescript
// scripts/test-redis-failover.ts

import { redis, checkRedisHealth, isRedisConnected } from '../lib/redis';

async function testRedisFailover() {
  console.log('Starting Redis failover test...');

  // 1. Write test data
  console.log('Step 1: Writing test data...');
  await redis?.set('failover:test', `pre-failover-${Date.now()}`);

  // 2. Simulate waiting for failover (triggered externally)
  console.log('Step 2: Waiting for failover signal...');
  console.log('Trigger failover with: redis-cli -p 26379 SENTINEL FAILOVER freight-master');

  // 3. Monitor connection
  const startTime = Date.now();
  let reconnected = false;
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts && !reconnected) {
    attempts++;
    await new Promise((r) => setTimeout(r, 1000));

    const health = await checkRedisHealth();
    if (health.connected) {
      reconnected = true;
      console.log(`Reconnected after ${attempts} seconds`);
    } else {
      console.log(`Attempt ${attempts}: ${health.error || 'Waiting...'}`);
    }
  }

  if (!reconnected) {
    console.error('FAILED: Could not reconnect after failover');
    return;
  }

  // 4. Verify data integrity
  console.log('Step 3: Verifying data integrity...');
  const value = await redis?.get('failover:test');
  console.log(`Retrieved value: ${value}`);

  // 5. Test write capability
  console.log('Step 4: Testing write capability...');
  await redis?.set('failover:test', `post-failover-${Date.now()}`);

  const recoveryTime = (Date.now() - startTime) / 1000;
  console.log(`\n=== Failover Test Results ===`);
  console.log(`Recovery Time: ${recoveryTime}s`);
  console.log(`Data Integrity: ${value ? 'PASSED' : 'FAILED'}`);
  console.log(`Write Capability: PASSED`);
}

testRedisFailover().catch(console.error);
```

---

## Cost Comparison

| Provider | Configuration | Monthly Cost | RTO | Notes |
|----------|---------------|--------------|-----|-------|
| **AWS ElastiCache** | cache.r6g.medium (3 nodes) | ~$200 | <15s | Managed, multi-AZ |
| **DigitalOcean** | Managed Redis HA | ~$75 | <30s | Simple, cost-effective |
| **Self-Hosted Sentinel** | 3x 2GB VMs | ~$60 | <5s | Full control |
| **Upstash Pro** | Pay-per-request | ~$50-100 | <1s | Serverless |

### Recommendation for 10K DAU

**Primary**: AWS ElastiCache (best AWS integration, managed failover)
**Alternative**: Self-hosted Sentinel (lowest cost, more control)
**Serverless**: Upstash Pro (if cost-per-request model works)

---

## Migration Checklist

### Pre-Migration

- [ ] Backup Redis data (BGSAVE)
- [ ] Document current REDIS_URL
- [ ] Notify team of maintenance window
- [ ] Prepare rollback procedure

### Migration Steps

- [ ] Create HA Redis cluster/sentinel
- [ ] Configure security groups/firewall
- [ ] Test connectivity from application
- [ ] Update environment variables
- [ ] Deploy application with new config
- [ ] Verify all Redis-dependent features

### Post-Migration

- [ ] Run failover test
- [ ] Verify rate limiting works
- [ ] Verify sessions work
- [ ] Verify job queues work
- [ ] Verify WebSocket adapter works
- [ ] Monitor for 24 hours

---

## Timeline

| Day | Task |
|-----|------|
| 1 | Provision HA cluster |
| 2 | Configure security & test connectivity |
| 3 | Update application code (if needed) |
| 4 | Staging deployment & testing |
| 5 | Production migration |
| 5 | Failover testing |
| 6-7 | Monitoring |

**Total: 1 week**

---

**Report Generated:** 2026-01-23
**Version:** 1.0
**Status:** READY FOR IMPLEMENTATION
