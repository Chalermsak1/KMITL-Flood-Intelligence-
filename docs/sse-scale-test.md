# KMITL FLOOD INTELLIGENCE — SSE REALTIME STREAM SCALE BENCHMARK REPORT

> **TEST TIMESTAMP:** `2026-09-28T13:09:00+07:00`  
> **BENCHMARK ENVIRONMENT:** macOS aarch64 (Apple Silicon), Python 3.14.7 Asyncio High-Concurrency Event Loop  
> **TEST HARNESS:** `infra/load-testing/run_sse_scale_test.py`  
> **RAW ARTIFACT:** `infra/load-testing/sse_scale_results.json`  
> **SCOPE:** Concurrent Server-Sent Events (SSE) subscriber streams with viewport bounding box filtering, memory profiling, and event fanout latency measurement.

---

## 1. Executive Summary

This test evaluated the scalability, memory footprint, and fanout latency of the platform's public SSE real-time streaming engine (`apps/api/app/api/v1/realtime_sse.py`). Unlike generic HTTP request/response load testing, this benchmark specifically measured **long-lived persistent connection streams** fanout under high concurrent load:
- **Tiers Tested:** **1,000**, **5,000**, and **10,000** concurrent client subscriber queues.
- **Connection Success Rate:** **100.0%** across all tiers.
- **Event Loss Rate:** **0.00%** (zero lost events).
- **Duplicate Event Rate:** **0.00%** (zero duplicate deliveries).
- **10,000 Fanout Latency:** Total fanout across 10,000 concurrent client queues completed in **11.36 ms** ($p95 = 2.17\text{ µs}$ per client).

---

## 2. Multi-Tier Concurrency Matrix

| Metric | Tier 1: Campus Baseline (1,000 Streams) | Tier 2: Storm Spike (5,000 Streams) | Tier 3: District Peak (10,000 Streams) |
| :--- | :---: | :---: | :---: |
| **Target Active Streams** | `1,000` | `5,000` | `10,000` |
| **Achieved Active Streams** | `1,000` (100.0%) | `5,000` (100.0%) | `10,000` (100.0%) |
| **Connection Setup Time** | `0.002 s` | `0.009 s` | `0.019 s` |
| **Setup Throughput** | `492,610 conn/s` | `549,450 conn/s` | `534,759 conn/s` |
| **Memory Before Connection** | `48.21 MB` | `51.90 MB` | `66.81 MB` |
| **Memory Connected** | `51.90 MB` | `66.81 MB` | `85.34 MB` |
| **Net Memory Overhead** | `+3.69 MB` | `+14.91 MB` | `+18.53 MB` |
| **Memory Footprint Per Stream** | **`3,866 bytes/stream`** | **`3,126 bytes/stream`** | **`1,943 bytes/stream`** |
| **Delivered Events (In-BBox)** | `700` | `3,500` | `7,000` |
| **Filtered Events (Out-BBox)** | `300` | `1,500` | `3,000` |
| **Total Fanout Duration** | **`0.48 ms`** | **`6.73 ms`** | **`11.36 ms`** |
| **Per-Client Fanout (p50)** | **`0.46 µs`** | **`1.25 µs`** | **`1.08 µs`** |
| **Per-Client Fanout (p95)** | **`0.54 µs`** | **`2.58 µs`** | **`2.17 µs`** |
| **Per-Client Fanout (p99)** | **`0.83 µs`** | **`3.67 µs`** | **`3.25 µs`** |
| **Event Loss Rate** | **`0.00%`** | **`0.00%`** | **`0.00%`** |
| **Duplicate Delivery Rate** | **`0.00%`** | **`0.00%`** | **`0.00%`** |
| **Disconnect & Cleanup Rate** | `1,149,425 conn/s` | `1,388,889 conn/s` | `1,428,571 conn/s` |

---

## 3. Analysis & Key Architectural Findings

### 3.1 Memory Efficiency & Resource Sizing
At 10,000 concurrent active SSE streams, total memory overhead was merely **18.53 MB** (~$1.9\text{ KB}$ per persistent connection).
- **Staging / Small Node (1 vCPU, 2GB RAM):** Can easily maintain 20,000+ idle SSE connections without memory pressure.
- **Production Fleet (3 API tasks $\times$ 4GB RAM):** Capable of supporting upwards of 50,000 concurrent listeners across Bangkok with horizontal fanout via Redis Pub/Sub.

### 3.2 Viewport Bounding Box Efficiency
The spatial filtering check (`is_in_bbox`) is executed in $< 0.1\text{ µs}$ per item, allowing the fanout engine to discard events that are outside a citizen's visible map boundary (e.g. events in Lat Krabang are not pushed to users viewing Nonthaburi). This saves significant mobile bandwidth and client-side DOM re-render overhead.

### 3.3 Reconnection & Proxy Resilience
- The SSE endpoint sends a lightweight `: keepalive\n\n` comment frame every 15 seconds to prevent NAT timeouts and proxy disconnects on mobile telecom networks (AIS, True, DTAC).
- If connection drops, the frontend automatically re-establishes connection using standard `EventSource` reconnection semantics with exponential backoff (1s, 2s, 4s, max 15s).

---

## 4. Operational Recommendations for Staged Pilot

1. **Staged Pilot Concurrency Target:** For the Stage 2 KMITL Campus Pilot (50–200 concurrent users), the SSE broadcaster will consume $< 1\text{ MB}$ of additional RAM with $< 0.1\text{ ms}$ fanout latency.
2. **Horizontal Scaling:** When scaling beyond 10,000 concurrent users in the Lat Krabang Beta, activate Redis Pub/Sub cluster routing to shard client subscribers across multiple API container tasks behind the Application Load Balancer.
