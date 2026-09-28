# Phase 29 Performance & Resource Limits Report

**Date**: September 28, 2026  
**Methodology**: Direct HTTP load testing on real TCP sockets + observational telemetry from controlled beta users  

---

## 1. Segregation of Test Environments & Traffic Types

| Performance Dimension | Synthetic Loopback Benchmark | Controlled TCP Load Test | Real Controlled Beta Traffic |
| :--- | :--- | :--- | :--- |
| **Client Type** | In-memory asyncio mock | httpx real TCP socket pool | Real mobile browsers (Safari/Chrome) |
| **Concurrency Level** | 1,000 synthetic | 100, 250, 500 connections | 15–85 concurrent humans |
| **Total Requests** | 10,000 requests | 2,500 requests | 2,820 daily requests |
| **Achieved RPS** | 1,420 req/s (mock) | **250.4 req/s (warm DB)** | **12.5 peak req/s (organic)** |
| **Latency p50** | 1.8 ms | **12.4 ms** | **24.6 ms** |
| **Latency p95** | 4.2 ms | **38.6 ms** | **68.2 ms** |
| **Latency p99** | 9.8 ms | **82.1 ms** | **142.0 ms** |
| **5xx Error Rate** | 0.0% | **0.0% (fallback active)** | **0.0%** |
| **Database Pool Utilization**| N/A | **65% (13/20 active conns)**| **15% (3/20 active conns)** |

---

## 2. Resource Utilization & Autoscaling Thresholds

To prevent resource exhaustion during severe weather events, the following operating thresholds are defined and monitored:

| System Resource | Current Beta Value | `WARN` Threshold | `DEGRADED` Threshold | `CRITICAL` Rollback Trigger |
| :--- | :--- | :--- | :--- | :--- |
| **CPU (API Container)** | 14% | > 65% for 3 min | > 80% for 2 min | > 90% for 1 min |
| **Memory (API Container)**| 185 MB | > 350 MB | > 450 MB | > 500 MB (OOM risk) |
| **PostgreSQL Conns** | 4 / 20 pool conns | > 14 conns | > 18 conns | 20 conns (exhaustion) |
| **DB Query Latency** | 3.2 ms | > 50 ms | > 150 ms | > 500 ms |
| **Queue Depth (Pending)** | 0 jobs | > 25 jobs | > 100 jobs | > 250 jobs |
| **Worker CPU / RAM** | 8% / 120 MB | > 70% | > 85% | > 95% |
| **SSE Connections** | 85 clients | > 200 clients | > 350 clients | > 500 clients |
| **Network Egress** | 1.2 MB/s | > 8.0 MB/s | > 15.0 MB/s | > 25.0 MB/s |

### Autoscaling Rules (ECS / Container Fleet)
- **Scale Out**: When API CPU exceeds 65% OR queue backlog exceeds 50 messages for > 2 minutes -> Spawn +1 API/Worker task.
- **Scale In**: When CPU remains < 30% and queue depth is 0 for > 15 minutes -> Terminate idle tasks down to minimum 2 instances.
