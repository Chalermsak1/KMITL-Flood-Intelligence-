# KMITL FLOOD INTELLIGENCE — SECURITY & ANTI-ABUSE VALIDATION
**Document ID:** `SEC-VAL-2026-V1`  
**Evaluation Date:** 2026-09-28  
**Scope:** Public API, Authentication Boundaries, File Ingestion, Privacy Defense, and Geospatial Input Vectors  

---

## 1. Security Baseline & Vulnerability Scan Results

| Security Control | Test Vector / Target | Defense Mechanism | Audit Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **SQL Injection (DAST)** | BBox query parameter (`100.70' OR 1=1;--`) | Parameterized queries via GeoAlchemy2 / SQLAlchemy ORM; regex coordinate split. | Zero SQL syntax errors; input parsed or rejected safely. | **PASSED** |
| **Path Traversal** | Photo upload filename (`../../etc/passwd`) | Object storage uses randomized UUID4 keys (`uuid.uuid4()`); original client filenames discarded. | Path traversal structurally impossible. | **PASSED** |
| **Oversized Uploads (DoS)**| Image payloads $> 5\text{MB}$ | FastAPI file header length check + streaming byte counter (`MAX_FILE_SIZE = 5 * 1024 * 1024`). | HTTP 413 / 400 rejected before memory buffer exhaustion. | **PASSED** |
| **Malicious Binaries (Polyglots)**| Executable disguised as `.jpg` (`MZ` header or shell script) | Magic bytes inspection (`b'\xff\xd8\xff'`, `b'\x89PNG\r\n\x1a\n'`, `b'RIFF'...'WEBP'`). | Malicious binaries rejected with `ValueError("Invalid image header")`. | **PASSED** |
| **EXIF Privacy Leakage** | Citizen smartphone photos containing GPS coordinates | `PIL.Image` EXIF stripping re-encodes pure RGB pixel buffer. | Output image bytes contain 0 GPS metadata tags. | **PASSED** |
| **Coordinate Spoofing / Out of Range**| `latitude: 999.0` or non-numeric coordinates | Pydantic v2 schema constraints (`-90 <= lat <= 90`, `-180 <= lng <= 180`). | Returns HTTP 422 Unprocessable Entity. | **PASSED** |
| **Brute Force & Rate Limit Abuse**| Rapid report / SOS submissions | In-memory token-bucket limiter (10 reports/min, 3 SOS/min, 5 uploads/min per IP). | Triggers standard HTTP 429 Too Many Requests with backoff. | **PASSED** |
| **Citizen PII Disclosure** | Public reports & incidents endpoints | Schemas exclude `reporter_name`, `contact_phone`, and `ip_address`. Exact coordinates masked to incident centroid. | Zero citizen phone numbers or names exposed on public endpoints. | **PASSED** |
| **Secret Leakage in Git** | Secret scanning across repo | `.env.production.example` sanitized; Terraform uses SSM/KMS parameter placeholders. | Zero plaintext secrets committed to master branch. | **PASSED** |

---

## 2. Dynamic Vulnerability Test Suite Evidence

All test cases are verified in automated test suites:
- `apps/api/tests/test_security_privacy.py`
- `apps/api/tests/test_schemas.py`
- `apps/api/tests/test_image_verifier.py`
