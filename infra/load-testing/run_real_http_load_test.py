"""
REAL HTTP LOAD TEST (P3-01)
Runs against a real uvicorn process via actual TCP (not ASGI transport).
Baseline: 50 concurrent virtual users, 200 total requests.
Endpoint: GET /api/v1/situation/summary (highest-value route)
"""

import asyncio
import time
import statistics
import httpx


BASE_URL = "http://127.0.0.1:8765"
CONCURRENT = 50
TOTAL_REQUESTS = 200
TARGET_ENDPOINT = "/api/v1/situation/summary"


async def single_request(client: httpx.AsyncClient, semaphore: asyncio.Semaphore) -> tuple[int, float]:
    """Returns (status_code, latency_ms)."""
    async with semaphore:
        start = time.perf_counter()
        try:
            r = await client.get(TARGET_ENDPOINT, timeout=5.0)
            elapsed_ms = (time.perf_counter() - start) * 1000
            return r.status_code, elapsed_ms
        except Exception as e:
            elapsed_ms = (time.perf_counter() - start) * 1000
            return 0, elapsed_ms  # 0 = connection error


async def main():
    semaphore = asyncio.Semaphore(CONCURRENT)
    results: list[tuple[int, float]] = []

    print(f"\n{'='*60}")
    print(f"KMITL FLOOD INTELLIGENCE — REAL HTTP LOAD TEST (P3-01)")
    print(f"Target : {BASE_URL}{TARGET_ENDPOINT}")
    print(f"Mode   : Real TCP/IP (uvicorn process, no ASGI bypass)")
    print(f"VUs    : {CONCURRENT} concurrent | {TOTAL_REQUESTS} total requests")
    print(f"{'='*60}")

    # Warm-up ping
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        try:
            ping = await client.get(TARGET_ENDPOINT, timeout=5.0)
            if ping.status_code not in (200, 422, 500):
                print(f"WARNING: warm-up returned {ping.status_code}. Server may not be ready.")
        except Exception as e:
            print(f"FATAL: Cannot reach {BASE_URL} — {e}")
            print("Start uvicorn before running this test.")
            return

        print(f"\nServer reachable. Sending {TOTAL_REQUESTS} requests...")
        t0 = time.perf_counter()

        tasks = [single_request(client, semaphore) for _ in range(TOTAL_REQUESTS)]
        results = await asyncio.gather(*tasks)

    total_elapsed_s = time.perf_counter() - t0

    # Analyse
    statuses = [r[0] for r in results]
    latencies = [r[1] for r in results]

    ok_2xx = sum(1 for s in statuses if 200 <= s < 300)
    err_5xx = sum(1 for s in statuses if s >= 500)
    conn_err = sum(1 for s in statuses if s == 0)

    latency_sorted = sorted(latencies)
    p50 = statistics.median(latency_sorted)
    p95 = latency_sorted[int(len(latency_sorted) * 0.95)]
    p99 = latency_sorted[int(len(latency_sorted) * 0.99)]
    p_max = max(latency_sorted)
    p_min = min(latency_sorted)

    throughput = TOTAL_REQUESTS / total_elapsed_s

    print(f"\n{'─'*60}")
    print(f"RESULTS (REAL TCP/IP — {BASE_URL})")
    print(f"{'─'*60}")
    print(f"Total Requests    : {TOTAL_REQUESTS}")
    print(f"Elapsed Wall Time : {total_elapsed_s:.2f}s")
    print(f"Throughput        : {throughput:.1f} req/s")
    print(f"")
    print(f"HTTP 2xx (OK)     : {ok_2xx} ({ok_2xx/TOTAL_REQUESTS*100:.1f}%)")
    print(f"HTTP 5xx (Error)  : {err_5xx} ({err_5xx/TOTAL_REQUESTS*100:.1f}%)")
    print(f"Connection Errors : {conn_err}")
    print(f"")
    print(f"Latency (ms)")
    print(f"  Min    : {p_min:.2f}")
    print(f"  p50    : {p50:.2f}")
    print(f"  p95    : {p95:.2f}")
    print(f"  p99    : {p99:.2f}")
    print(f"  Max    : {p_max:.2f}")
    print(f"{'─'*60}")

    # Gate evaluation
    gate_5xx = err_5xx / TOTAL_REQUESTS < 0.005
    gate_p95 = p95 < 800.0
    gate_conn = conn_err == 0

    print(f"\nGATE EVALUATION (Real TCP Baseline)")
    print(f"  5xx rate < 0.5%     : {'PASS' if gate_5xx else 'FAIL'}")
    print(f"  p95 latency < 800ms : {'PASS' if gate_p95 else 'FAIL'} ({p95:.1f}ms)")
    print(f"  Zero conn errors    : {'PASS' if gate_conn else 'FAIL'}")

    overall = "PASS" if (gate_5xx and gate_p95 and gate_conn) else "FAIL"
    print(f"\nOVERALL GATE : {overall}")
    print(f"\nNOTE: This test runs against a single-worker uvicorn on localhost.")
    print(f"Production would use gunicorn multi-worker + nginx. These figures")
    print(f"represent single-core baseline, NOT projected multi-instance capacity.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(main())
