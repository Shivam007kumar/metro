# Gate Logic — Entry vs Exit

## Entry Gate (`gate/entry.py`)

### Purpose
Verify rider identity and allow entry if enrolled + sufficient balance.

### Flow
```
Phone broadcasts BLE (cypher_id)
        │
        ▼
ESP32 scans → serial → "FOUND:METRO-XXX:-45"
        │
        ▼
Camera captures face
        │
        ▼
dlib detects face → shape → 128D embedding
        │
        ▼
ChromaDB query → nearest match → get name + cypher_id
        │
        ▼
┌─────────────────────────────────┐
│ MATCH CHECK                     │
│ 1. Face distance < 0.50?        │
│ 2. Face cypher_id == BLE signal?│
│ 3. Both true → IDENTITY OK     │
└─────────────────────────────────┘
        │
        ▼
API call: POST /gate/entry
        │
        ▼
┌─────────────────────────────────┐
│ BACKEND CHECKS                  │
│ 1. User is_enrolled?            │
│ 2. wallet_balance ≥ MIN_FARE?   │
│ 3. No active IN_TRANSIT trip?   │
└─────────────────────────────────┘
        │
    ┌───┴───┐
    ▼       ▼
  ALLOW   DENY
    │       │
    ▼       ▼
Create trip    Record denied
(IN_TRANSIT)   attempt
    │
    ▼
Open gate
(serial → ESP32 → servo)
```

### Entry API Endpoint (to be added)
```
POST /gate/entry
Body: { user_id, station_name, cypher_id }
Auth: Gate API key (not user JWT — gate acts on behalf of user)

Response:
{
  "access_granted": true,
  "trip_id": "uuid",
  "message": "Welcome, Shivam"
}
```

---

## Exit Gate (`gate/exit.py`)

### Purpose
Verify identity, calculate distance-based fare, deduct, complete trip.

### Flow
```
Same BLE + face verification as entry
        │
        ▼
API call: POST /gate/exit
        │
        ▼
┌─────────────────────────────────┐
│ BACKEND LOGIC                   │
│ 1. Find active IN_TRANSIT trip  │
│ 2. entry_station → exit_station │
│ 3. Look up fare from FARE_MATRIX│
│ 4. Deduct from wallet_balance   │
│ 5. Update trip: COMPLETED       │
└─────────────────────────────────┘
        │
    ┌───┴───┐
    ▼       ▼
  ALLOW   DENY (no active trip,
    │      or can't find entry)
    ▼
Open gate
```

### Exit API Endpoint (to be added)
```
POST /gate/exit
Body: { user_id, station_name, cypher_id }

Response:
{
  "access_granted": true,
  "entry_station": "Andheri",
  "exit_station": "Ghatkopar",
  "fare_charged": 40,
  "new_balance": 160,
  "trip_duration_mins": 22
}
```

---

## Fare Matrix

Distance-based fare for Mumbai Metro Line 1 (Versova ↔ Ghatkopar):

| Stations apart | Fare (₹) |
|---------------|----------|
| 1 | 10 |
| 2 | 15 |
| 3 | 20 |
| 4 | 25 |
| 5 | 30 |
| 6 | 35 |
| 7 | 40 |
| 8 | 45 |
| 9 | 50 |
| 10 | 55 |
| 11 | 60 |

### Station Order (index for distance calc)
```
0: Versova
1: D.N. Nagar
2: Azad Nagar
3: Andheri
4: Western Express Highway
5: Chakala
6: Airport Road
7: Marol Naka
8: Saki Naka
9: Asalpha
10: Jagruti Nagar
11: Ghatkopar
```

**Fare = base(₹10) + ₹5 × (station_distance - 1)**

Example: Andheri (3) → Ghatkopar (11) = |11-3| = 8 stations = ₹10 + ₹5×7 = **₹45**

---

## Edge Cases

| Case | Entry | Exit |
|------|-------|------|
| Insufficient balance | Deny entry | N/A (already inside) |
| No face match | Deny | Deny (alert security) |
| BLE signal mismatch | Deny | Deny |
| Already IN_TRANSIT | Deny re-entry | Allow exit |
| No matching entry trip | N/A | Deny exit (alert) |
| Timeout (>3 hrs) | N/A | Charge max fare |
| Multiple faces | Ignore (process largest in ROI) | Same |

---

## Gate ↔ Backend Authentication

Gates should NOT use user JWTs. Instead:
- Each gate gets a **gate API key** (stored in gate's `.env`)
- Backend verifies gate key + gate ID
- Gate sends the **user_id** it identified (from face+BLE match)
- Backend trusts the gate's identity claim (gate is a controlled device)

```
Gate .env:
GATE_API_KEY=gk_live_xxxxxxxxxxxxxx
GATE_ID=G-01
GATE_MODE=ENTRY
STATION_NAME=Andheri
BACKEND_URL=http://192.168.1.100:8000
```
