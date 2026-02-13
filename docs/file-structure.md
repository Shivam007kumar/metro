# Proposed File Structure

## Current Structure (messy)
```
metro/
├── .env                    ← shared env (confusing)
├── main.py                 ← entry gate logic (at root!)
├── config.py               ← gate config (at root!)
├── register_local.py       ← offline registration tool (at root!)
├── ingest_chroma.py        ← dataset ingestion (at root!)
├── download_models.py      ← model downloader (at root!)
├── backend/                ← FastAPI API server
│   ├── main.py             ← API endpoints
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── requirements.txt
├── app/                    ← Expo React Native app
│   ├── app/                ← screens
│   ├── src/                ← store, api, services
│   └── ...
├── models/                 ← AI model files (large)
├── chroma_db/              ← vector database
├── dataset/                ← face images
├── datasetog/              ← original dataset (large!)
└── venv/                   ← Python virtual env
```

**Problems:**
- Root is cluttered with gate scripts, tools, and configs
- No separation between gate code, backend, and tools
- Two `main.py` files (root + backend/) — confusing
- `.env` at root is ambiguous (gate? backend? both?)

---

## Proposed Structure (organized)

```
metro/
│
├── docs/                           ← 📚 Documentation
│   ├── architecture.md             ← System overview
│   ├── gate-logic.md               ← Entry/Exit logic spec
│   ├── master.md                   ← Master controller spec
│   ├── file-structure.md           ← This file
│   └── setup.md                    ← Setup & deployment guide
│
├── app/                            ← 📱 Mobile App (Expo RN)
│   ├── app/                        ← Screens (Expo Router)
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx           ← Home
│   │   │   ├── pass.tsx            ← Digital Pass + BLE
│   │   │   ├── history.tsx         ← Trip History
│   │   │   └── profile.tsx         ← Profile
│   │   ├── _layout.tsx             ← Root navigator
│   │   ├── index.tsx               ← Login/Signup
│   │   └── scan.tsx                ← Face Enrollment
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js           ← Axios + API functions
│   │   ├── store/
│   │   │   └── userStore.js        ← Zustand state
│   │   ├── services/
│   │   │   └── bleAdvertiser.js    ← BLE broadcasting
│   │   └── lib/
│   │       └── supabase.js         ← Supabase client
│   ├── .env                        ← App env (SUPABASE_URL, ANON_KEY)
│   ├── app.json
│   └── package.json
│
├── backend/                        ← 🖥️ API Server (FastAPI)
│   ├── main.py                     ← API endpoints
│   ├── database.py                 ← SQLAlchemy setup
│   ├── models.py                   ← ORM models
│   ├── schemas.py                  ← Pydantic schemas
│   ├── requirements.txt
│   └── .env                        ← Backend env (SUPABASE_URL, SERVICE_KEY)
│
├── gate/                           ← 🚪 Gate Hardware Scripts
│   ├── config.py                   ← Gate configuration
│   ├── entry.py                    ← Entry gate logic (was main.py)
│   ├── exit.py                     ← Exit gate logic (TO BUILD)
│   ├── master.py                   ← Station controller (TO BUILD)
│   ├── .env                        ← Gate env (GATE_API_KEY, GATE_ID, etc.)
│   └── README.md                   ← Gate setup instructions
│
├── tools/                          ← 🔧 Utilities & Scripts
│   ├── register_local.py           ← Offline face registration
│   ├── ingest_chroma.py            ← Bulk dataset ingestion
│   └── download_models.py          ← Model file downloader
│
├── models/                         ← 🧠 AI Models (gitignored)
│   ├── shape_predictor_68_face_landmarks.dat
│   └── dlib_face_recognition_resnet_model_v1.dat
│
├── chroma_db/                      ← 💾 Vector DB (gitignored)
│
├── .gitignore
└── README.md                       ← Project overview
```

---

## Migration Steps (when ready to reorganize)

1. **Create directories:**
   ```bash
   mkdir -p gate tools
   ```

2. **Move gate files:**
   ```bash
   mv main.py gate/entry.py
   mv config.py gate/config.py
   ```

3. **Move tool files:**
   ```bash
   mv register_local.py tools/
   mv ingest_chroma.py tools/
   mv download_models.py tools/
   ```

4. **Create gate .env:**
   ```bash
   # gate/.env
   GATE_API_KEY=gk_live_xxxxxxxxxxxxxx
   GATE_ID=G-01
   GATE_MODE=ENTRY
   STATION_NAME=Andheri
   BACKEND_URL=http://localhost:8000
   ```

5. **Update imports in moved files:**
   - `gate/entry.py` → update `config` import path
   - `gate/entry.py` → update `chroma_db` and `models` paths
   - `tools/` scripts → update paths

6. **Update `.gitignore`:**
   ```
   gate/.env
   backend/.env
   ```

7. **Commit:**
   ```bash
   git add -A && git commit -m "refactor: organize project file structure"
   ```
