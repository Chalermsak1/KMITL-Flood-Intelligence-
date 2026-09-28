# Runbook: Security Incident & Anti-Abuse Mitigation
**Runbook ID:** `RB-SEC-ABUSE-009`  
**Service:** AWS WAF, Security Middleware (`app/core/security.py`), Audit Log Subsystem  
**Alert:** `AlertWAFBlockedRateHigh` / `AlertAbnormalReportVolume`  

---

### 1. Symptoms & Trigger
- Sudden flood of automated bot submissions at identical GPS coordinates or rapidly shifting bogus coordinates.
- Multiple failed administrative authentication attempts against `/admin` or `/api/v1/auth`.
- WAF rate-limiting rules trigger > 100 blocks per minute.

### 2. Operational Impact
- Risk of false alarm panic if fraudulent flood reports are clustered into active incidents.
- Potential degradation of operator triage efficiency if fake SOS calls overwhelm the EOC queue.

### 3. Diagnostic Steps
1. Inspect anomalous report submission patterns:
   ```sql
   SELECT ip_address, count(*) 
   FROM audit_logs 
   WHERE action = 'CREATE_REPORT' AND timestamp > NOW() - interval '15 minutes'
   GROUP BY ip_address 
   HAVING count(*) > 20 
   ORDER BY count(*) DESC;
   ```
2. Check image uploads for malicious polyglot binaries or oversized payloads bypassing client checks.
3. Review audit logs for unauthorized role escalation attempts.

### 4. Remediation Procedure
1. **IP & ASN Blocking:**
   - Add malicious source IP CIDRs to the AWS WAF block list:
     ```bash
     aws wafv2 update-ip-set --name kmitl-flood-blocked-ips --scope REGIONAL ...
     ```
2. **Flag & Purge Fraudulent Incidents:**
   - In Admin EOC (`/admin`), batch flag malicious reports as `FALSE_REPORT`.
   - Trigger asynchronous incident recalculation so the public map removes fake hotspots.
3. **Emergency Credential Invalidation:**
   - If an operator session is compromised, immediately rotate JWT secret key in SSM Parameter Store and revoke active responder bearer tokens.

### 5. Verification
- Verify anomalous traffic drops to zero on WAF metrics.
- Confirm only verified citizen reports remain visible on public map.
- Confirm audit trail records all defensive mitigation actions.
