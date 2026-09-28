# KMITL Flood Intelligence — Production Secrets & Credential Security (Phase 27)

## 1. Zero Hardcoded Secrets Policy

The KMITL Flood Intelligence platform adheres to a zero-compromise credential security policy:
- **No secrets, private keys, or passwords committed to Git.**
- **No tokens or secret keys bundled in client-side Next.js assets.**
- **Automatic runtime failure in production if development default secrets are detected.**
- **All credentials injected exclusively via container environment variables or secure cloud secret managers (AWS Secrets Manager / GCP Secret Manager / Vault).**

---

## 2. Secrets Inventory & Purpose

| Variable Name | Sensitivity | Injection Method | Least-Privilege Scope | Rotation Cadence |
|---|---|---|---|---|
| `DATABASE_URL` | **CRITICAL** | Env / Secret Manager | Read/Write access strictly to `kmitl_flood` DB; no superuser. | 90 Days |
| `SECRET_KEY` | **CRITICAL** | Env / Secret Manager | HS256 JWT signing for EOC admin sessions. Min 32 random chars. | 60 Days |
| `REDIS_URL` | **HIGH** | Env / Secret Manager | Pub/Sub and caching only; network isolated in VPC. | 90 Days |
| `COPERNICUS_CLIENT_ID` | **MEDIUM** | Env | Read-only OAuth2 client for Sentinel-1 STAC API. | 180 Days |
| `COPERNICUS_CLIENT_SECRET` | **CRITICAL** | Env / Secret Manager | OAuth2 client secret for ESA Copernicus Data Space. | 90 Days |
| `TMD_UID` / `TMD_UKEY` | **HIGH** | Env / Secret Manager | TMD Open Data API reader (Thai Meteorological Dept). | 180 Days |
| `BMA_API_KEY` | **HIGH** | Env / Secret Manager | Bangkok Drainage and Sewerage Dept telemetry reader. | 180 Days |
| `TRAFFY_API_KEY` | **HIGH** | Env / Secret Manager | NECTEC Traffy Fondue Open Data ticket reader. | 180 Days |

---

## 3. Secret Masking in Logs & Error Responses

1. **Log Sanitization**:
   FastAPI structured logging filters all authorization headers (`Authorization: Bearer ***`) and strips connection string passwords (`postgresql+asyncpg://user:***@host:port/db`) before emitting to stdout or Datadog/CloudWatch.
2. **Exception Sanitization**:
   Database connection failures or external HTTP errors surface only generic messages (`"Database service temporarily degraded"`, `"Upstream provider timeout"`) to API callers. Internal stack traces containing credentials are never returned in HTTP 5xx bodies.

---

## 4. Production Secret Rotation Runbook

### Routine Rotation Procedure:
1. Generate new cryptographically secure secret (e.g., `openssl rand -hex 32`).
2. Update secret in Cloud Secret Manager / `.env.production`.
3. Perform rolling container restart (`docker service update` or Kubernetes rollout) with zero downtime.
4. Verify application health via `/api/v1/health` and `/api/v1/beta/features/admin`.
5. Revoke prior credential at the provider portal (Copernicus, TMD, BMA, NECTEC).

### Emergency Leak Containment (< 15 Minutes):
1. Immediately invoke the feature kill-switch:
   ```bash
   # If external API leaked, disable adapter immediately
   curl -X POST http://localhost:8000/api/v1/beta/features \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"flag_name": "FEATURE_FLAG_TMD", "value": false, "reason": "Emergency credential rotation"}'
   ```
2. Invalidate leaked key on provider portal.
3. Deploy new container with refreshed credential.
4. Review access logs in `AuditLog` table and cloud audit trail for unauthorized usage during exposure window.
