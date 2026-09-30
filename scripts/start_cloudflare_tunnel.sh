#!/usr/bin/env bash
# High-reliability Cloudflare Tunnel daemon for KMITL Flood Intelligence
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while true; do
  echo "[$(date)] Launching Cloudflare Tunnel (HTTP/2 via Bangkok Edge)..."
  "${ROOT_DIR}/bin/cloudflared" tunnel --protocol http2 --url http://localhost:3000
  echo "[$(date)] Cloudflare tunnel process exited, restarting in 3 seconds..."
  sleep 3
done
