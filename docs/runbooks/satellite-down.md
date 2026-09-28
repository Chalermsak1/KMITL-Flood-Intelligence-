# Runbook: Copernicus Sentinel-1 STAC API Down
**Runbook ID:** `RB-EXT-SAT-004`  
**Service:** `app/adapters/satellite.py`, `app/workers/satellite_worker.py`  
**Alert:** `AlertExternalSourceUnavailable: Copernicus STAC`  

---

### 1. Symptoms & Trigger
- CloudWatch Alert: Copernicus Data Space STAC endpoint (`https://stac.dataspace.copernicus.eu/v1/search`) returns 504 Gateway Timeout or 503.
- Scheduled 6-hour satellite pass checks fail.

### 2. Operational Impact
- Synoptic flood polygon observation footprints do not refresh.
- **Critical Policy:** Satellite SAR observations are strictly coarse observational evidence (revisit cadence 6–12 days). A satellite outage has **ZERO impact** on live minute-by-minute road safety or user flood reporting.
- Frontend continues displaying the most recent verified observation with explicit `data_age_hours` and observational disclaimer.

### 3. Diagnostic Steps
1. Test STAC endpoint reachability:
   ```bash
   curl -s "https://stac.dataspace.copernicus.eu/v1/collections/SENTINEL-1-GRD" | jq .id
   ```
2. Verify Copernicus Ecosystem system notices: [https://dataspace.copernicus.eu/](https://dataspace.copernicus.eu/).

### 4. Remediation Procedure
1. Satellite passes occur only every few days; retry with exponential backoff up to 2 hours.
2. If credentials/tokens change, verify CDSE OpenID authentication configuration in `SatelliteAdapter`.

### 5. Verification
- Verify `/api/v1/satellite/latest` returns 200 with the valid persisted GeoJSON footprint and correct disclaimer.
