# AI Computer Vision & Citizen Verification Pipeline
## KMITL FLOOD INTELLIGENCE

---

## 1. Philosophical Principle: Verification Assistance

In disaster intelligence, **AI does not have the authority to arbitrate whether a citizen is lying**. 
Rather, AI serves as **Verification Assistance**:
1. Flagging unreadable, dark, or severely blurred images.
2. Detecting identical duplicate photos submitted from nearby locations to prevent astroturfing or double-counting.
3. Estimating visual indicators (water surface reflections, street context, water level relative to curbs/wheels).
4. Providing a confidence score to prioritize operator triage.

---

## 2. Image Pipeline Architecture

```
User Upload (Multipart/Form-Data)
      │
      ▼
[Magic Bytes Header Validation] (Reject arbitrary scripts/executables)
      │
      ▼
[EXIF Metadata Sanitization] (Privacy Protection)
      │
      ▼
[Object Storage S3/Local] (Never store binary blobs in PostgreSQL)
      │
      ▼
[Durable Queue Dispatch] (Returns HTTP 201 <50ms)
      │
      ▼
[Async AI Worker Fleet]
      ├── 1. Quality Scoring (Laplacian Variance blur, Luminance check)
      ├── 2. 64-bit dHash (Perceptual Hashing & Hamming distance)
      ├── 3. Multi-label Classifier (Water surface & road context)
      └── 4. Depth Band Heuristic (Not exact physical centimeters)
            │
            ▼
[Update Report Confidence & Trigger Incident Clustering]
```

---

## 3. Depth Band Classification & Disclaimers

The model estimates water levels into standardized discrete bands:
- **`BELOW_10CM`**: Minor surface puddles, pedestrian ankle level.
- **`10_TO_20CM`**: Halfway up passenger car tire; curb covered.
- **`20_TO_40CM`**: Wheel hub height; small passenger sedans risk engine stall.
- **`40_TO_60CM`**: Exhaust level; passable only by high-clearance trucks.
- **`ABOVE_60CM`**: Severe inundation; boat or military truck only.
- **`UNKNOWN`**: Insufficient visual cues or obscured ground plane.

> [!CAUTION]
> **Mandatory AI Disclaimer:**
> *"AI Estimate (Uncalibrated Visual Clue) — Not an in-situ physical measurement. Do not use for engineering precision."*

---

## 4. Human-In-The-Loop Override

Authorized EOC operators have full authority to override AI classifications:
- `AI_CONFIRMED`: Operator validates that the image corroborates the report.
- `ADMIN_VERIFIED`: Field responder on-site confirms the situation physically.
- `REJECTED`: Spam, duplicate, or unrelated photograph.

Every manual override records:
- `actor_id`
- `old_status`
- `new_status`
- `reason`
- `timestamp`
into the immutable `audit_logs` table.
