# Master Controller — `gate/master.py`

## Purpose

Central station management process that:
1. Registers and monitors entry/exit gates
2. Provides real-time operational dashboard
3. Runs OLAP analytics queries on trip data
4. Manages station configuration

---

## Architecture

```
                    ┌─────────────┐
                    │  master.py  │
                    │  (FastAPI)  │
                    └──────┬──────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼─────┐ ┌─────▼──────┐ ┌────▼─────────┐
     │  Gate G-01  │ │  Gate G-02 │ │  Gate G-03   │
     │  ENTRY      │ │  EXIT      │ │  ENTRY       │
     │  Andheri    │ │  Andheri   │ │  Ghatkopar   │
     └─────────────┘ └────────────┘ └──────────────┘
```

---

## Gate Registry

Master maintains a live registry of all connected gates:

```python
gate_registry = {
    "G-01": {
        "mode": "ENTRY",
        "station": "Andheri",
        "status": "ONLINE",          # ONLINE / OFFLINE / MAINTENANCE
        "last_heartbeat": "2026-02-13T23:00:00",
        "processed_today": 342,
        "ip": "192.168.1.10"
    },
    "G-02": {
        "mode": "EXIT",
        "station": "Andheri",
        "status": "ONLINE",
        "last_heartbeat": "2026-02-13T23:00:01",
        "processed_today": 289,
        "ip": "192.168.1.11"
    }
}
```

### Heartbeat Protocol
- Each gate pings master every 10 seconds
- If no heartbeat for 30s → mark OFFLINE → alert
- Endpoint: `POST /gate/heartbeat` with gate_id + stats

---

## OLAP Queries

### Revenue Analytics

```sql
-- Daily revenue by station
SELECT 
    exit_station,
    DATE(exit_time) AS day,
    SUM(fare_charged) AS revenue,
    COUNT(*) AS trips
FROM trips
WHERE status = 'COMPLETED'
GROUP BY exit_station, DATE(exit_time)
ORDER BY day DESC, revenue DESC;

-- Hourly revenue trend
SELECT 
    EXTRACT(HOUR FROM entry_time) AS hour,
    SUM(fare_charged) AS revenue,
    COUNT(*) AS trip_count
FROM trips
WHERE status = 'COMPLETED'
    AND entry_time >= CURRENT_DATE
GROUP BY hour
ORDER BY hour;
```

### Traffic Analytics

```sql
-- Passenger count per station per hour (entry)
SELECT 
    entry_station,
    EXTRACT(HOUR FROM entry_time) AS hour,
    COUNT(*) AS passengers
FROM trips
WHERE entry_time >= CURRENT_DATE
GROUP BY entry_station, hour
ORDER BY entry_station, hour;

-- Peak hours (top 5 busiest hours today)
SELECT 
    EXTRACT(HOUR FROM entry_time) AS hour,
    COUNT(*) AS total_entries
FROM trips
WHERE entry_time >= CURRENT_DATE
GROUP BY hour
ORDER BY total_entries DESC
LIMIT 5;

-- Station-to-station flow (OD matrix)
SELECT 
    entry_station,
    exit_station,
    COUNT(*) AS trip_count,
    AVG(fare_charged) AS avg_fare
FROM trips
WHERE status = 'COMPLETED'
    AND entry_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY entry_station, exit_station
ORDER BY trip_count DESC;
```

### Operational Analytics

```sql
-- Currently in-transit riders
SELECT 
    t.user_id,
    p.full_name,
    t.entry_station,
    t.entry_time,
    NOW() - t.entry_time AS duration
FROM trips t
JOIN profiles p ON t.user_id = p.id
WHERE t.status = 'IN_TRANSIT'
ORDER BY t.entry_time;

-- Average trip duration per route
SELECT 
    entry_station,
    exit_station,
    AVG(EXTRACT(EPOCH FROM (exit_time - entry_time)) / 60) AS avg_minutes,
    COUNT(*) AS trips
FROM trips
WHERE status = 'COMPLETED'
GROUP BY entry_station, exit_station
HAVING COUNT(*) >= 5
ORDER BY avg_minutes DESC;

-- Denial rate by station
SELECT 
    station_name AS station,
    COUNT(*) AS total_attempts,
    SUM(CASE WHEN access_granted = false THEN 1 ELSE 0 END) AS denied,
    ROUND(
        SUM(CASE WHEN access_granted = false THEN 1 ELSE 0 END)::numeric 
        / COUNT(*)::numeric * 100, 1
    ) AS denial_pct
FROM trips
WHERE entry_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY station
ORDER BY denial_pct DESC;
```

### Financial Analytics

```sql
-- Wallet balance distribution
SELECT 
    CASE 
        WHEN wallet_balance = 0 THEN '₹0 (empty)'
        WHEN wallet_balance < 50 THEN '₹1-49 (low)'
        WHEN wallet_balance < 200 THEN '₹50-199'
        WHEN wallet_balance < 500 THEN '₹200-499'
        ELSE '₹500+'
    END AS balance_range,
    COUNT(*) AS users
FROM profiles
GROUP BY balance_range
ORDER BY MIN(wallet_balance);

-- Top-up trends (would need a wallet_transactions table)
-- Low-balance riders at risk of denial
SELECT 
    p.full_name,
    p.wallet_balance,
    p.email
FROM profiles p
WHERE p.is_enrolled = true
    AND p.wallet_balance < 20
ORDER BY p.wallet_balance;
```

---

## Dashboard Endpoints (master.py API)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Web UI (HTML dashboard) |
| GET | `/api/stats/realtime` | In-transit count, active gates, today's revenue |
| GET | `/api/stats/revenue?period=7d` | Revenue analytics |
| GET | `/api/stats/traffic?station=Andheri` | Station traffic data |
| GET | `/api/stats/od-matrix` | Origin-Destination flow |
| GET | `/api/gates` | All registered gates + status |
| POST | `/api/gates/{gate_id}/override` | Force open/close a gate |
| POST | `/gate/heartbeat` | Gate heartbeat receiver |
| GET | `/api/alerts` | Active alerts (offline gates, stuck riders) |

---

## Alerts

| Alert | Trigger | Action |
|-------|---------|--------|
| Gate offline | No heartbeat in 30s | Notify station master |
| Long in-transit | Rider > 3 hours | Flag for max fare |
| High denial rate | > 20% denials in 1 hour | Check camera/BLE |
| Low balance wave | > 10 denials in 10 min | Consider announcing |
| Face mismatch spike | > 5 mismatches in 5 min | Security alert |
