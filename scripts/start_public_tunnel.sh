#!/usr/bin/env bash
# Persistent keep-alive tunnel script for KMITL Flood Intelligence
while true; do
  echo "[$(date)] Starting public HTTPS tunnel on port 3000 (subdomain: kmitl-flood-test)..."
  npx -y localtunnel --port 3000 --subdomain kmitl-flood-test
  echo "[$(date)] Tunnel process terminated, restarting in 2 seconds..."
  sleep 2
done
