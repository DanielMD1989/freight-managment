# Monitoring & Observability Guide

## Overview

The freight management platform includes comprehensive built-in monitoring capabilities through the `/api/health` endpoint. This guide covers how to integrate with external monitoring tools.

## Health Endpoint

### Basic Health Check

```bash
GET /api/health

# Response:
{
  "status": "healthy",
  "timestamp": "2026-01-25T12:00:00.000Z",
  "version": "1.0.0",
  "database": { "status": "connected", "latencyMs": 5 },
  "redis": { "enabled": true, "status": "connected", "latencyMs": 2 }
}
```

### Detailed Health Check

```bash
GET /api/health?detailed=true

# Additional metrics:
{
  "pool": {
    "totalConnections": 20,
    "idleConnections": 15,
    "activeConnections": 5,
    "utilizationPercent": 25
  },
  "rateLimit": { "mode": "distributed" },
  "cache": { "hitRate": 75, "status": "optimal" },
  "queues": { "status": "active", "totals": { "waiting": 0, "active": 2 } },
  "storage": { "provider": "s3", "status": "healthy" },
  "monitoring": { "healthScore": 95, "activeAlerts": 0 },
  "system": {
    "cpu": { "usage": 15, "loadAverage": [0.5, 0.4, 0.3] },
    "memory": { "usagePercent": 45, "heapUsedMB": 256 },
    "uptime": 86400
  }
}
```

## Key Metrics to Monitor

### Database Metrics

| Metric                    | Description           | Alert Threshold |
| ------------------------- | --------------------- | --------------- |
| `database.latencyMs`      | Query latency         | > 100ms         |
| `pool.utilizationPercent` | Connection pool usage | > 80%           |
| `pool.waitingRequests`    | Queued connections    | > 0             |

### Cache Metrics

| Metric          | Description          | Alert Threshold |
| --------------- | -------------------- | --------------- |
| `cache.hitRate` | Cache hit percentage | < 50%           |
| `cache.status`  | Cache health         | != "optimal"    |

### Queue Metrics

| Metric                  | Description  | Alert Threshold |
| ----------------------- | ------------ | --------------- |
| `queues.totals.failed`  | Failed jobs  | > 0             |
| `queues.totals.waiting` | Waiting jobs | > 100           |
| `queues.status`         | Queue health | != "active"     |

### System Metrics

| Metric                       | Description    | Alert Threshold |
| ---------------------------- | -------------- | --------------- |
| `system.cpu.usage`           | CPU percentage | > 80%           |
| `system.memory.usagePercent` | Memory usage   | > 85%           |
| `system.eventLoop.latencyMs` | Event loop lag | > 100ms         |

## Grafana Setup

### 1. Add Data Source

Configure Prometheus or JSON API data source pointing to:

```
https://your-domain.com/api/health?detailed=true
```

### 2. Import Dashboard

```json
{
  "title": "Freight Management Platform",
  "panels": [
    {
      "title": "System Health",
      "type": "stat",
      "targets": [{ "expr": "monitoring.healthScore" }],
      "thresholds": [
        { "color": "red", "value": 0 },
        { "color": "yellow", "value": 70 },
        { "color": "green", "value": 90 }
      ]
    },
    {
      "title": "Database Latency",
      "type": "graph",
      "targets": [{ "expr": "database.latencyMs" }]
    },
    {
      "title": "Cache Hit Rate",
      "type": "gauge",
      "targets": [{ "expr": "cache.hitRate" }],
      "min": 0,
      "max": 100
    },
    {
      "title": "Queue Status",
      "type": "table",
      "targets": [{ "expr": "queues.totals" }]
    }
  ]
}
```

### 3. Recommended Dashboards

1. **Overview Dashboard**
   - Health score gauge
   - Active alerts count
   - System uptime

2. **Database Dashboard**
   - Connection pool utilization
   - Query latency histogram
   - Error rate

3. **Queue Dashboard**
   - Jobs by status (waiting, active, completed, failed)
   - Processing rate
   - Queue depths

4. **Application Dashboard**
   - Request rate
   - Error rate
   - Response time percentiles

## Prometheus Integration

### Scrape Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "freight-management"
    metrics_path: "/api/health"
    params:
      detailed: ["true"]
    static_configs:
      - targets: ["your-domain.com"]
    scrape_interval: 30s
```

### Key Prometheus Queries

```promql
# CPU Usage
freight_system_cpu_usage

# Memory Usage
freight_system_memory_usagePercent

# Database Latency P95
histogram_quantile(0.95, rate(freight_database_latency_bucket[5m]))

# Cache Hit Rate
freight_cache_hitRate

# Failed Queue Jobs
increase(freight_queues_totals_failed[5m])
```

## Datadog Integration

### Agent Configuration

```yaml
# datadog.yaml
init_config:
instances:
  - name: freight-management
    url: https://your-domain.com/api/health?detailed=true
    method: GET
    collect_response_time: true
    headers:
      Accept: application/json
```

### Custom Metrics

```python
# custom_check.py
from datadog_checks.base import AgentCheck
import requests

class FreightHealthCheck(AgentCheck):
    def check(self, instance):
        response = requests.get(instance['url'])
        data = response.json()

        # Database metrics
        self.gauge('freight.database.latency', data['database']['latencyMs'])

        # Cache metrics
        self.gauge('freight.cache.hitRate', data['cache']['hitRate'])

        # Queue metrics
        self.gauge('freight.queues.waiting', data['queues']['totals']['waiting'])
        self.gauge('freight.queues.failed', data['queues']['totals']['failed'])

        # System metrics
        self.gauge('freight.system.cpu', data['system']['cpu']['usage'])
        self.gauge('freight.system.memory', data['system']['memory']['usagePercent'])
```

## Alerting Configuration

### Critical Alerts

```yaml
alerts:
  - name: "Database Unhealthy"
    condition: database.status != "connected"
    severity: critical
    action: page-on-call

  - name: "High CPU Usage"
    condition: system.cpu.usage > 80
    duration: 5m
    severity: warning

  - name: "Queue Backlog"
    condition: queues.totals.waiting > 100
    severity: warning

  - name: "Cache Cold"
    condition: cache.hitRate < 50
    duration: 10m
    severity: warning

  - name: "Failed Jobs"
    condition: queues.totals.failed > 0
    severity: warning
```

### PagerDuty Integration

```yaml
# pagerduty.yaml
routing_key: "YOUR_INTEGRATION_KEY"
event_action: "trigger"
payload:
  summary: "Freight Management Alert"
  source: "freight-management-prod"
  severity: "critical"
  custom_details:
    health_endpoint: "https://your-domain.com/api/health?detailed=true"
```

## Log Aggregation

### Structured Logging

The platform uses structured logging with these fields:

```json
{
  "level": "info",
  "timestamp": "2026-01-25T12:00:00.000Z",
  "message": "Request completed",
  "requestId": "req-123",
  "userId": "user-456",
  "method": "POST",
  "path": "/api/loads",
  "statusCode": 200,
  "durationMs": 45,
  "metadata": {}
}
```

### Elasticsearch/Kibana Setup

```json
// Index template
{
  "index_patterns": ["freight-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 1
    },
    "mappings": {
      "properties": {
        "timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "message": { "type": "text" },
        "requestId": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "statusCode": { "type": "integer" },
        "durationMs": { "type": "float" }
      }
    }
  }
}
```

## SLA Monitoring

The platform tracks these SLA metrics:

| Metric            | Target  | Endpoint                      |
| ----------------- | ------- | ----------------------------- |
| Uptime            | 99.9%   | `/api/health`                 |
| Response Time P95 | < 500ms | `/api/health?detailed=true`   |
| Error Rate        | < 1%    | `logging.requests.errorCount` |
| On-time Pickup    | > 90%   | `/api/shipper/analytics`      |
| On-time Delivery  | > 85%   | `/api/shipper/analytics`      |

## Runbook

### Health Check Failed

1. Check `/api/health?detailed=true` for specific failures
2. Verify database connectivity: `database.status`
3. Check Redis: `redis.status`
4. Review recent deployments
5. Check system resources: `system.cpu`, `system.memory`

### High Queue Backlog

1. Check `queues.totals.waiting`
2. Identify queue: `queueDetails[].waiting`
3. Check worker status: `workers.status`
4. Scale workers if needed
5. Check for failed jobs: `queues.totals.failed`

### Cache Performance Degradation

1. Check `cache.hitRate`
2. Review `cacheByNamespace` for specific issues
3. Check Redis connectivity
4. Consider cache warm-up
5. Review TTL settings

---

**Document Version:** 1.0
**Last Updated:** January 2026
