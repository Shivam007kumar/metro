# Metro Gate System Documentation

This document provides a comprehensive guide to understanding, setting up, and running the Metro Gate System.

## 1. Project Overview

The Metro Gate System is a contactless biometric entry/exit system for metro stations. It combines Face Recognition and Bluetooth Low Energy (BLE) beacon detection for a seamless "walk-through" experience.

### Key Features
- **Dual-Factor Authentication**: Face Verification (via camera) + BLE Signal (via user's phone acting as a beacon).
- **Contactless Entry**: Users simply walk through the gate; authentication happens automatically.
- **Auto-Fare Calculation**: Fares are calculated based on the distance between Entry and Exit stations.
- **Master Controller**: A real-time dashboard for station managers to monitor traffic, revenue, and alerts.
- **Mobile App**: A React Native (Expo) app for users to manage their identity, top-up wallets, and view trip history.

## 2. Architecture

The system is composed of four main components:

1.  **Mobile App (Frontend)**
    -   Built with React Native (Expo).
    -   Handles user registration, face enrollment (via WebSocket), wallet management, and trip history.
    -   Communicates with the Backend API.

2.  **Backend API**
    -   Built with Python (FastAPI).
    -   Manages user data, wallets, and trips in Supabase (PostgreSQL).
    -   Handles face enrollment and verification using `dlib` and ChromaDB (vector database).
    -   Provides WebSocket endpoints for real-time face capture.

3.  **Gate Hardware (Entry & Exit)**
    -   **Entry Gate (`main.py`)**: Runs on a local machine (simulating the gate). Uses OpenCV for face detection and Serial communication for BLE signals (from ESP32). verifies identity and balance.
    -   **Exit Gate (`exit.py`)**: Similar to the Entry Gate but handles fare calculation and deduction upon exit.

4.  **Master Controller (`master.py`)**
    -   A separate FastAPI service providing a dashboard for station admins.

### Data Flow
-   **Enrollment**: User -> Mobile App -> WebSocket -> Backend -> ChromaDB (Face Vectors) & Supabase (Profile).
-   **Entry**: User -> Gate Camera (Face) + ESP32 (BLE) -> `main.py` -> Backend (Balance Check) -> Gate Open/Close.
-   **Exit**: User -> Exit Gate Camera + ESP32 -> `exit.py` -> Backend (Fare Deduct) -> Gate Open/Close.

## 3. Codebase Structure

-   **`app/`**: Contains the React Native mobile application code.
    -   `app.json`: Expo configuration.
    -   `App.js` / `app/`: Main application logic and screens.
-   **`backend/`**: Contains the Backend API code.
    -   `main.py`: The main FastAPI application.
    -   `database.py`, `models.py`, `schemas.py`: Database connection and data models.
    -   `requirements.txt`: Python dependencies for the backend.
-   **`chroma_db/`**: Directory where ChromaDB stores vector embeddings locally.
-   **`models/`**: Directory storing AI models (`shape_predictor_68_face_landmarks.dat`, `dlib_face_recognition_resnet_model_v1.dat`).
-   **`dataset/`**: Directory for storing dataset images (if applicable).
-   **`docs/`**: Documentation files.
-   **`main.py`**: The Entry Gate script.
-   **`exit.py`**: The Exit Gate script.
-   **`master.py`**: The Master Controller script.
-   **`config.py`**: Configuration file for hardware settings (Camera, Serial Port, Gate Mode).
-   **`register_local.py`**: Utility script for local registration (optional).

## 4. Setup & Installation

### Prerequisites
-   **Python 3.9+**
-   **Node.js 16+** (for the App)
-   **Supabase Account** (for the Database)
-   **Hardware**: Webcam + ESP32 (for BLE) *[Optional: can be simulated or bypassed]*

### Database Setup (Supabase)
1.  Create a new project in Supabase.
2.  Run the SQL scripts provided in `README.md` (or `docs/setup.md` if available) to create the `profiles`, `stations`, and `trips` tables.
3.  Note down your `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`.

### Backend Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Create a `.env` file in the **project root** containing your Supabase credentials:
    ```ini
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_SERVICE_KEY=your-service-role-key
    ```
5.  **Exposing the Backend**: To make the backend accessible to the mobile app (especially if running on a physical device) or external networks, you can use `cloudflared`.
    Run the following command in a separate terminal to create a tunnel to your local backend:
    ```bash
    cloudflared tunnel run --url http://localhost:8000 backend
    ```
    *Note: Ensure `cloudflared` is installed and configured on your machine.*

### Mobile App Setup
1.  Navigate to the `app` directory:
    ```bash
    cd app
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the Expo development server:
    ```bash
    npx expo start
    ```
4.  Scan the QR code with the Expo Go app on your phone.

## 5. Running the System

You will typically need **3 Terminal Windows** running simultaneously.

### Terminal 1: Backend API
Handles authentication, user management, and trip logic.
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```
*Don't forget to run the `cloudflared` tunnel if you need external access!*

### Terminal 2: Master Controller
Real-time dashboard for station statistics.
```bash
# In project root
uvicorn master:app --reload --port 8001
```
Access the dashboard at: [http://localhost:8001/dashboard](http://localhost:8001/dashboard)

### Terminal 3: Gate Script (Entry or Exit)
Simulates the physical gate hardware.

**To run the Exit Gate:**
```bash
# In project root
source backend/venv/bin/activate
python3 exit.py
```

**To run the Entry Gate:**
1.  Edit `config.py` and set `GATE_MODE = "ENTRY"`.
2.  Run the script:
    ```bash
    # In project root
    source backend/venv/bin/activate
    python3 main.py
    ```

## 6. Configuration (`config.py`)

The `config.py` file in the root directory controls hardware settings for the Python scripts:

-   `SERIAL_PORT`: The serial port where your ESP32 is connected (e.g., `/dev/cu.usbserial...` or `COM3`).
-   `CAMERA_INDEX`: The ID of your webcam (usually `0` for built-in, `1` for external).
-   `GATE_MODE`: Set to `"ENTRY"` or `"EXIT"` to determine the behavior of `main.py`.
-   `STATION_NAME`: The name of the station (e.g., "Ghatkopar"). This must match entries in the `FARE_TABLE` in `backend/main.py`.
-   `DB_PATH`: Path to the local ChromaDB storage.
-   `MODELS_DIR`: Path to the AI models directory.

### API Keys
-   **Gate API Key**: There is a hardcoded API key (`gk_live_xxxxxxxxxxxxxx`) in `backend/main.py` and the gate scripts (`exit.py`). Ensure these match. In a production environment, this should be securely managed.
-   **Supabase Keys**: Managed via the `.env` file.

## 7. Troubleshooting

-   **Camera not opening?** Check `config.py` → `CAMERA_INDEX`. Ensure no other app is using the camera.
-   **Serial Error?** Check if the ESP32 is plugged in and `SERIAL_PORT` is correct in `config.py`.
-   **"User not found"?** Ensure the user has completed enrollment in the App and has a valid `cypher_id`.
-   **Backend Connection Issues?** If the app cannot connect to the backend, ensure your phone and computer are on the same network, or better yet, use the `cloudflared` tunnel command provided above.

---
*Generated by Antigravity for Metro Gate System.*
