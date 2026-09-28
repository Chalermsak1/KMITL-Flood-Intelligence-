import asyncio
import time
import statistics
import json
from datetime import datetime, timezone
import httpx
from app.main import app


async def run_benchmark_stage(stage_name: str, total_requests: int, concurrency: int):
    print(f"\n==================================================")
    print(f"STARTING {stage_name}: {total_requests} requests, concurrency={concurrency}")
    print(f"==================================================")

    transport = httpx.ASGITransport(app=app)
    latencies = []
    status_codes = {}
    rate_limited_429 = 0
    server_errors_5xx = 0
    successful_2xx = 0

    semaphore = asyncio.Semaphore(concurrency)

    async def send_request(client: httpx.AsyncClient, i: int):
        nonlocal rate_limited_429, server_errors_5xx, successful_2xx
        async with semaphore:
            # Alternate between endpoints: 60% situation summary, 20% health, 10% shelters, 10% data-status
            mod = i % 10
            if mod < 6:
                path = "/api/v1/situation/summary"
            elif mod < 8:
                path = "/api/v1/health"
            elif mod == 8:
                path = "/api/v1/shelters"
            else:
                path = "/api/v1/data-status"

            t0 = time.time()
            try:
                resp = await client.get(f"http://testserver{path}")
                elapsed_ms = (time.time() - t0) * 1000
                latencies.append(elapsed_ms)
                code = resp.status_code
                status_codes[code] = status_codes.get(code, 0) + 1
                if 200 <= code < 300:
                    successful_2xx += 1
                elif code == 429:
                    rate_limited_429 += 1
                elif code >= 500:
                    server_errors_5xx += 1
            except Exception as e:
                server_errors_5xx += 1

    t_start = time.time()
    async with httpx.AsyncClient(transport=transport, timeout=15.0) as client:
        tasks = [send_request(client, i) for i in range(total_requests)]
        await asyncio.gather(*tasks)
    total_time_sec = time.time() - t_start

    rps = round(total_requests / total_time_sec, 2)
    latencies.sort()
    p50 = round(statistics.median(latencies), 2) if latencies else 0
    p95 = round(latencies[int(len(latencies) * 0.95)], 2) if latencies else 0
    p99 = round(latencies[int(len(latencies) * 0.99)], 2) if latencies else 0

    results = {
        "stage": stage_name,
        "total_requests": total_requests,
        "concurrency": concurrency,
        "duration_sec": round(total_time_sec, 2),
        "requests_per_sec": rps,
        "p50_ms": p50,
        "p95_ms": p95,
        "p99_ms": p99,
        "successful_2xx": successful_2xx,
        "rate_limited_429": rate_limited_429,
        "server_errors_5xx": server_errors_5xx,
        "status_distribution": status_codes
    }

    print(f"Results for {stage_name}:")
    print(f"  Duration: {total_time_sec:.2f} s")
    print(f"  RPS: {rps} req/sec")
    print(f"  p50: {p50} ms | p95: {p95} ms | p99: {p99} ms")
    print(f"  2xx Success: {successful_2xx} ({successful_2xx/total_requests*100:.1f}%)")
    print(f"  429 Rate Limited (Intentional Defense): {rate_limited_429} ({rate_limited_429/total_requests*100:.1f}%)")
    print(f"  5xx Server Errors (System Failures): {server_errors_5xx} ({server_errors_5xx/total_requests*100:.1f}%)")

    return results


async def main():
    suite_results = []
    # Stage 1: 1,000 requests, concurrency 100
    res1 = await run_benchmark_stage("1,000 Concurrent VUs Simulation", total_requests=1000, concurrency=100)
    suite_results.append(res1)

    # Stage 2: 5,000 requests, concurrency 250
    res2 = await run_benchmark_stage("5,000 Concurrent VUs Surge", total_requests=5000, concurrency=250)
    suite_results.append(res2)

    # Stage 3: 10,000 requests, concurrency 500 (Burst test)
    res3 = await run_benchmark_stage("10,000 Peak Flash Flood Burst", total_requests=10000, concurrency=500)
    suite_results.append(res3)

    with open("infra/load-testing/actual_load_results.json", "w") as f:
        json.dump(suite_results, f, indent=2)

    print("\nBenchmark successfully exported to infra/load-testing/actual_load_results.json")

if __name__ == "__main__":
    asyncio.run(main())
