# ManAgeX ANPR Integration API

## Overview

The ManAgeX ANPR (Automatic Number Plate Recognition) API allows external camera systems and access control hardware to verify vehicle plates in real time. The API returns an access decision instantly, logs the event, and optionally triggers gate open/close signals via webhook.

**Base URL:** `https://api.managex.sg/v1`  
**Authentication:** Bearer token (issued per property)  
**Format:** JSON  
**Rate limit:** 60 requests/minute per API key  

---

## Endpoints

### `POST /anpr/check`

Check whether a vehicle plate should be granted access at a specific gate.

**Request headers:**
```
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request body:**
```json
{
  "plate": "SJK4521T",
  "gate_id": "carpark-a",
  "property_id": "riviera-gardens",
  "timestamp": "2025-06-24T10:33:00+08:00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `plate` | string | ✓ | Vehicle plate number (alphanumeric, case-insensitive) |
| `gate_id` | string | ✓ | Gate identifier configured in ManAgeX settings |
| `property_id` | string | ✓ | Property slug from ManAgeX dashboard |
| `timestamp` | ISO 8601 | ✓ | Local timestamp with timezone offset |
| `image_url` | string | — | Optional: URL to captured plate image for audit log |
| `confidence` | float | — | Optional: OCR confidence score (0.0–1.0) |

**Response — granted:**
```json
{
  "access": "granted",
  "reason": "pre_registered_guest",
  "unit": "#02-14",
  "host": "Rajesh Kumar",
  "valid_until": "2025-06-24T18:00:00+08:00",
  "log_id": "acc_20250624_4821",
  "gate_signal": "open"
}
```

**Response — resident:**
```json
{
  "access": "granted",
  "reason": "registered_resident_vehicle",
  "unit": "#02-14",
  "owner": "Rajesh Kumar",
  "log_id": "acc_20250624_4820",
  "gate_signal": "open"
}
```

**Response — denied:**
```json
{
  "access": "denied",
  "reason": "unregistered_plate",
  "plate": "SKL8812",
  "log_id": "acc_20250624_4819",
  "gate_signal": "hold",
  "alert": "security_notified"
}
```

**Response — pending:**
```json
{
  "access": "pending",
  "reason": "ma_approval_required",
  "plate": "SBA4411G",
  "log_id": "acc_20250624_4818",
  "gate_signal": "hold"
}
```

**`reason` values:**
| Value | Description |
|-------|-------------|
| `registered_resident_vehicle` | Plate belongs to an approved resident vehicle |
| `pre_registered_guest` | Plate registered as guest pass by a resident |
| `unregistered_plate` | Plate not found in system |
| `ma_approval_required` | Plate submitted but awaiting MA approval |
| `expired_pass` | Guest pass has expired |
| `blacklisted` | Plate has been flagged/blocked |

---

### `GET /anpr/log`

Retrieve access event log.

```
GET /anpr/log?property_id=riviera-gardens&from=2025-06-24&to=2025-06-24&outcome=denied
Authorization: Bearer {api_key}
```

**Query parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `property_id` | string | Required |
| `from` | date (YYYY-MM-DD) | Start date |
| `to` | date (YYYY-MM-DD) | End date |
| `gate_id` | string | Filter by gate |
| `outcome` | string | `granted`, `denied`, `pending` |
| `limit` | int | Max results (default 100, max 500) |

---

### `POST /gates/open`

Manually trigger a gate open signal (for security desk override).

```json
{
  "gate_id": "carpark-a",
  "property_id": "riviera-gardens",
  "reason": "security_override",
  "operator_id": "sec_001",
  "note": "Walk-in contractor approved by resident #07-08"
}
```

---

## Webhook — access events

Configure a webhook URL in ManAgeX settings to receive real-time push events.

**Event: `access.denied`** — fired on every denial for immediate security alert
```json
{
  "event": "access.denied",
  "timestamp": "2025-06-24T10:29:11+08:00",
  "plate": "SKL8812",
  "gate_id": "carpark-a",
  "property_id": "riviera-gardens",
  "log_id": "acc_20250624_4819"
}
```

**Event: `access.granted`** — optional, configurable per property
```json
{
  "event": "access.granted",
  "timestamp": "2025-06-24T10:33:00+08:00",
  "plate": "SJK4521T",
  "gate_id": "carpark-a",
  "unit": "#02-14",
  "reason": "pre_registered_guest",
  "log_id": "acc_20250624_4821"
}
```

---

## Integration notes

- **Latency target:** < 200ms p95 for the `/anpr/check` endpoint
- **Plate normalisation:** Spaces and hyphens are stripped. `S JK 4521 T`, `SJK-4521-T`, and `SJK4521T` resolve identically
- **Camera placement:** For best OCR results, camera should capture the rear plate at 0–30° angle, 2–8m distance
- **Tested integrations:** Hikvision DS-2CD2T47G2-L, Dahua IPC-HFW3849S-AS-PV, VIVOTEK FD9167-H

---

## Error codes

| HTTP status | Code | Description |
|-------------|------|-------------|
| 401 | `invalid_api_key` | API key missing or revoked |
| 403 | `property_not_authorised` | API key not authorised for this property |
| 422 | `invalid_plate_format` | Plate string failed validation |
| 429 | `rate_limit_exceeded` | Slow down — 60 req/min limit |
| 503 | `service_unavailable` | ManAgeX experiencing downtime |

On any 5xx error, your system should fail-open or fail-closed based on your security policy. ManAgeX recommends fail-open for resident gates and fail-closed for restricted areas.
