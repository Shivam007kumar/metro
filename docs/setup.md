# Setup & Deployment Guide

## Prerequisites

| Component | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Expo / React Native |
| Python | 3.10+ | Backend + Gate scripts |
| Expo CLI | Latest | Mobile app dev |
| Supabase account | — | Auth + Database |
| ESP32 dev board | — | BLE scanner at gate |
| USB webcam | — | Face detection at gate |

---

## 1. Database Setup (Supabase)

Run in **Supabase SQL Editor**:

```sql
-- Profiles columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_enrolled boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cypher_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance integer DEFAULT 0;

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  station_name text NOT NULL,
  entry_station text,
  exit_station text,
  entry_time timestamptz DEFAULT now(),
  exit_time timestamptz,
  fare_charged integer DEFAULT 0,
  access_granted boolean DEFAULT true,
  status text DEFAULT 'COMPLETED'
);

-- RLS
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own trips" ON trips;
CREATE POLICY "Users can read own trips" ON trips
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert trips" ON trips;
CREATE POLICY "Service can insert trips" ON trips
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update trips" ON trips;
CREATE POLICY "Service can update trips" ON trips
  FOR UPDATE USING (true);
```

---

## 2. Backend Setup

```bash
cd backend

# Create virtual env
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...your-service-key
EOF

# Run
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 3. Mobile App Setup

```bash
cd app

# Install dependencies
npm install

# Create .env
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key
EOF

# Run (Expo Go — no BLE)
npx expo start

# Run (Dev Build — with BLE, needs Xcode or Android Studio)
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android   # or npx expo run:ios
```

---

## 4. Gate Setup

```bash
cd gate  # (after file restructure)

# Activate same venv or create gate-specific one
source ../venv/bin/activate

# Create .env
cat > .env << EOF
GATE_API_KEY=gk_live_xxxxxxxxxxxxxx
GATE_ID=G-01
GATE_MODE=ENTRY
STATION_NAME=Andheri
BACKEND_URL=http://localhost:8000
SERIAL_PORT=/dev/cu.usbserial-0001
EOF

# Download AI models (if not already done)
python ../tools/download_models.py

# Run entry gate
python entry.py

# Run exit gate (once built)
python exit.py
```

---

## 5. ESP32 BLE Scanner Setup

Flash the ESP32 with the BLE scanner firmware:
- Scans for BLE devices with names starting with `METRO-`
- Sends format: `FOUND:METRO-XXXX:-45` via serial
- Baud rate: 115200

---

## Environment Variables Reference

### Backend (`backend/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (secret) |

### App (`app/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Anon/public key |

### Gate (`gate/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `GATE_API_KEY` | ✅ | Gate authentication key |
| `GATE_ID` | ✅ | Unique gate identifier |
| `GATE_MODE` | ✅ | `ENTRY` or `EXIT` |
| `STATION_NAME` | ✅ | Station name |
| `BACKEND_URL` | ✅ | Backend API URL |
| `SERIAL_PORT` | ✅ | ESP32 serial port |

---

## Ports

| Service | Port | URL |
|---------|------|-----|
| Backend API | 8000 | `http://localhost:8000` |
| Expo Dev Server | 8081 | `http://localhost:8081` |
| Master Dashboard | 8001 | `http://localhost:8001` (future) |
