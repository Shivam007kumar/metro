# Metro Gate — System Architecture

## Overview

Metro Gate is a biometric access control system for metro stations. It combines **face recognition** and **BLE (Bluetooth Low Energy)** for dual-factor verification at entry and exit gates.

```
┌─────────────────────────────────────────────────────────────┐
│                    METRO GATE SYSTEM                        │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │  Mobile   │    │  Gate    │    │    Backend Server     │  │
│  │   App     │◄──►│ Hardware │◄──►│   (FastAPI + DB)      │  │
│  │ (Expo RN) │    │(ESP32+Cam)│   │                      │  │
│  └──────────┘    └──────────┘    └──────────────────────┘  │
│        │                                    │               │
│        │         ┌──────────────┐           │               │
│        └────────►│   Supabase   │◄──────────┘               │
│                  │  (Postgres)  │                           │
│                  └──────────────┘                           │
│                         │                                   │
│                  ┌──────────────┐                           │
│                  │  master.py   │                           │
│                  │  (Dashboard) │                           │
│                  └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Mobile App (`app/`)
- **Tech:** Expo + React Native + TypeScript
- **Auth:** Supabase Auth (email/password)
- **State:** Zustand store with persistence
- **Features:**
  - User signup/login
  - Face enrollment (3-pose WebSocket stream to backend)
  - Digital pass with BLE broadcasting
  - Wallet management (add money via API)
  - Trip history (fetched from API)
  - Profile management

### 2. Backend API (`backend/main.py`)
- **Tech:** FastAPI + Supabase client
- **Auth:** JWT verification via Supabase service key
- **Endpoints:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/profile` | JWT | Get user profile |
| POST | `/wallet/add` | JWT | Add money to wallet |
| POST | `/confirm_enrollment` | JWT | Confirm face enrollment |
| GET | `/trips` | JWT | Get trip history |
| POST | `/gate/access` | JWT | Gate access + fare deduction |
| WS | `/ws/capture/{user_id}/{name}/{cypher_id}` | — | Face enrollment stream |

### 3. Entry Gate (`gate/entry.py` — currently `main.py` at root)
- **Hardware:** USB camera + ESP32 (BLE scanner via serial)
- **Flow:**
  1. ESP32 scans BLE → sends `FOUND:METRO-XXX:-45`
  2. Camera detects face → generates embedding → queries ChromaDB
  3. Matches face identity to BLE signal
  4. If match → calls backend API → creates IN_TRANSIT trip
  5. Opens gate

### 4. Exit Gate (`gate/exit.py` — TO BE BUILT)
- Same hardware as entry
- **Different logic:**
  1. Verifies identity (face + BLE)
  2. Finds user's active IN_TRANSIT trip
  3. Calculates fare based on entry → exit distance
  4. Deducts fare from wallet
  5. Completes trip record

### 5. Master Controller (`gate/master.py` — TO BE BUILT)
- Central station controller and analytics dashboard
- See [master.md](./master.md) for full spec

### 6. AI Engine
- **Face Detection:** dlib frontal face detector
- **Landmarks:** 68-point shape predictor
- **Embeddings:** dlib ResNet face recognition model (128D vectors)
- **Vector DB:** ChromaDB (persistent, shared between gates)
- **Match Threshold:** 0.50 (metro grade)

### 7. Database (Supabase / PostgreSQL)

#### `profiles` table
| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Supabase Auth user ID |
| full_name | text | User's name |
| email | text | User's email |
| wallet_balance | integer | Balance in ₹ |
| is_enrolled | boolean | Face enrollment complete? |
| cypher_id | text | BLE identifier (e.g., `METRO-A1B2C3D4`) |
| created_at | timestamptz | Account creation |

#### `trips` table
| Column | Type | Purpose |
|--------|------|---------|
| id | uuid (PK) | Trip ID |
| user_id | uuid (FK) | References profiles.id |
| entry_station | text | Where user entered |
| exit_station | text | Where user exited (null if in-transit) |
| entry_time | timestamptz | Tap-in time |
| exit_time | timestamptz | Tap-out time (null if in-transit) |
| fare_charged | integer | Final fare in ₹ |
| access_granted | boolean | Was access allowed? |
| status | text | `IN_TRANSIT`, `COMPLETED`, `DENIED` |

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| App → Backend API | JWT (Supabase access token) |
| Backend → Supabase | Service role key (server only) |
| App → Supabase (reads) | Anon key + RLS policies |
| Gate identity | Dual factor: face embedding + BLE cypher_id |
| Wallet mutations | Server-side only (never from client) |
