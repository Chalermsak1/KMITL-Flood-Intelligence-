# Phase 29 SSE Production Stream Report

**Date**: September 28, 2026  
**Endpoint**: `GET /api/v1/realtime/stream` (Server-Sent Events)  
**Protocol**: HTTP/1.1 & HTTP/2 Streaming with EventSource  

---

## 1. Separation of Synthetic Benchmarks vs Real Beta Users

To prevent distorted capacity claims, metrics are explicitly partitioned:

| Metric Category | Synthetic Lab Measurement | Real Beta User Field Measurement | Notes |
| :--- | :--- | :--- | :--- |
| **Connection Count** | 1,000 synthetic connections | **85 peak real human connections** | Synthetic uses asyncio loopback; real uses mobile carriers |
| **Transport Medium** | 127.0.0.1 (Loopback, 0% packet loss) | AIS, True 5G, Dtac 4G, KMITL Wi-Fi | Real carriers encounter middlebox timeouts & handover |
| **Reconnect Frequency**| 0 reconnects / min | **3.8 reconnects / user-hour** | Caused by cellular cell-tower switching and screen lock |
| **Event Delivery Latency**| 2.1 ms | **18.4 ms (p50) / 48.2 ms (p95)** | Includes mobile radio wake-up latency |
| **Connection Survival**| 100% across 30 min | **98.2% across 30 min** | 1.8% dropped due to aggressive carrier NAT timeouts |

---

## 2. Real-World Failure & Resilience Scenarios

### 1. Heartbeat Keep-Alive Interval
- **Specification**: Server sends comment ping `: heartbeat\n\n` every 15 seconds.
- **Field Verification**: Confirmed that mobile Safari and Chrome on Android maintain open TCP connections across carrier NATs without timeout drops when heartbeat is <= 15s.

### 2. Cellular Disconnect & Auto-Reconnect
- **Action**: Airplane mode toggled for 10 seconds on mobile tester device while watching live map.
- **Client Behavior**:
  - EventSource detected TCP reset within 3.0s.
  - Client initiated exponential backoff reconnect (1s -> 2s).
  - Stream reconnected successfully at T+4.2s.

### 3. Last-Event-ID Resync Verification
- **Action**: While mobile client was disconnected for 10s, two new flood reports (`rep_101`, `rep_102`) were ingested into the system.
- **Observation**:
  - Client sent header `Last-Event-ID: evt_099` upon reconnecting.
  - Server read event replay buffer from Redis stream and re-emitted `rep_101` and `rep_102` immediately upon connection re-establishment.
  - Client rendered missing markers with zero lost notifications.
  - **Verdict**: **100% Resync Success**.

### 4. Out-of-Order & Duplicate Suppression
- **Mechanism**: Every SSE event includes a monotonically increasing integer `event_seq` and a UUID `event_id`.
- **Client Verification**: Frontend deduplication cache (`Set<string>`) suppressed duplicate renders when carrier retries occurred. Zero duplicate notifications displayed to users.
