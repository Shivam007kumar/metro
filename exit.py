import cv2
import dlib
import numpy as np
import chromadb
import serial
import time
import os
import requests  # Needs: pip install requests
import config
from datetime import datetime

# ================= 0. CONFIG OVERRIDE =================
# We override the default config because this script runs at the Exit Gate
config.GATE_MODE = "EXIT"
config.STATION_NAME = "Ghatkopar"  # Simulating us being at Ghatkopar
API_URL = "http://localhost:8000/gate/exit"
API_KEY = "gk_live_xxxxxxxxxxxxxx" 

print(f"🚀 Metro Gate System: {config.GATE_MODE} MODE @ {config.STATION_NAME}")

# ================= 1. SETUP HARDWARE =================
print(f"🔌 Connecting to ESP32 on {config.SERIAL_PORT}...")
try:
    ser = serial.Serial(config.SERIAL_PORT, config.BAUD_RATE, timeout=0)
    print("✅ Serial Connected!")
except Exception as e:
    print(f"❌ Serial Error: {e}")
    ser = None

# ================= 2. SETUP AI =================
print("⏳ Loading AI Models...")
detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor(f"{config.MODELS_DIR}/shape_predictor_68_face_landmarks.dat")
facerec = dlib.face_recognition_model_v1(f"{config.MODELS_DIR}/dlib_face_recognition_resnet_model_v1.dat")

print(f"⏳ Loading Database from {config.DB_PATH}...")
client = chromadb.PersistentClient(path=config.DB_PATH)
collection = client.get_or_create_collection(name="metro_faces")
print("✅ System Online.")

# ================= 3. STATE MANAGEMENT =================
# Stores { "METRO-Shivam": {"rssi": -40, "time": 171000...} }
ble_signals = {} 

gate_status = "LOCKED"
display_message = ""
gate_timer = 0
last_api_call = 0
box_color = (0, 0, 255)

# ================= 4. MAIN LOOP =================
cap = cv2.VideoCapture(config.CAMERA_INDEX)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, config.FRAME_WIDTH)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, config.FRAME_HEIGHT)

while True:
    # --- A. READ SENSOR (Populate Signal Dictionary) ---
    if ser and ser.in_waiting > 0:
        try:
            raw_data = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
            lines = raw_data.split('\n')
            for line in lines:
                if "FOUND:" in line and "METRO" in line:
                    # Parse: "FOUND:METRO-Shivam:-45"
                    parts = line.replace("FOUND:", "").strip().split(':')
                    if len(parts) == 2:
                        name_tag = parts[0]
                        rssi = int(parts[1])
                        # Update Dictionary
                        ble_signals[name_tag] = {"rssi": rssi, "time": time.time()}
        except: pass

    # Clean old signals
    current_time = time.time()
    ble_signals = {k: v for k, v in ble_signals.items() if current_time - v["time"] < config.SIGNAL_TIMEOUT}

    # Find Strongest Signal
    strongest_signal_name = "None"
    max_rssi = -999
    
    for tag, data in ble_signals.items():
        if data["rssi"] > max_rssi and data["rssi"] > config.MIN_RSSI:
            max_rssi = data["rssi"]
            strongest_signal_name = tag

    # --- B. READ CAMERA ---
    ret, frame = cap.read()
    if not ret: break
    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape

    # Draw ROI Box
    roi_x1 = int(w * config.ROI_X_MIN_PCT)
    roi_x2 = int(w * config.ROI_X_MAX_PCT)
    cv2.rectangle(frame, (roi_x1, 50), (roi_x2, h-50), (255, 255, 0), 2)
    cv2.putText(frame, "ZONE", (roi_x1 + 10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,0), 1)

    # --- C. VISION PROCESSING ---
    small_frame = cv2.resize(frame, (0,0), fx=0.5, fy=0.5)
    gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
    
    # Sharpness Gate
    sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
    
    if sharpness > config.BLUR_THRESHOLD:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = detector(rgb, 0)
        
        target_face = None
        max_area = 0
        
        for face in faces:
            center_x = (face.left() + face.right()) // 2
            if roi_x1 < center_x < roi_x2:
                area = face.width() * face.height()
                if area > max_area:
                    max_area = area
                    target_face = face
        
        if target_face:
            shape = sp(rgb, target_face)
            vector = list(np.array(facerec.compute_face_descriptor(rgb, shape)))
            
            results = collection.query(query_embeddings=[vector], n_results=1)
            
            face_name = "Unknown"
            dist = 1.0
            expected_token = ""
            
            if results['distances'] and len(results['distances'][0]) > 0:
                dist = results['distances'][0][0]
                if dist < config.MATCH_THRESHOLD:
                    meta = results['metadatas'][0][0]
                    face_name = meta.get('name', 'Unknown')
                    expected_token = meta.get('cypher_id', '')

            # --- D. THE VERDICT (Face + RSSI Match) ---
            box_color = (0, 0, 255) # Default Red
            
            if face_name != "Unknown":
                # Check for Signal Match
                is_signal_match = False
                if expected_token == strongest_signal_name:
                    is_signal_match = True
                elif face_name.lower() in strongest_signal_name.lower():
                    is_signal_match = True
                
                if is_signal_match:
                    # MATCH FOUND!
                    
                    # Call API if not recently called (Debounce 5s)
                    if time.time() - last_api_call > 5:
                        print(f"🚀 Calling Exit API for {face_name} ({expected_token})...")
                        try:
                            res = requests.post(API_URL, json={
                                "station_name": config.STATION_NAME,
                                "cypher_id": expected_token
                            }, headers={"x-gate-api-key": API_KEY}, timeout=2)
                            
                            data = res.json()
                            if res.status_code == 200 and data.get("access_granted"):
                                fare = data.get("fare", 0)
                                bal = data.get("new_balance", 0)
                                gate_status = f"PAID: Rs.{fare}"
                                display_message = f"Bal: Rs.{bal}"
                                box_color = (0, 255, 0)
                                
                                # Open Gate (Servo Logic would go here)
                                if ser:
                                    ser.write(b'OPEN\n')

                            else:
                                reason = data.get("deny_reason", "Denied")
                                gate_status = "DENIED"
                                display_message = reason
                                box_color = (0, 0, 255)
                                
                            last_api_call = time.time()
                            gate_timer = time.time()

                        except Exception as e:
                            print(f"API Error: {e}")
                            gate_status = "API ERROR"
                            display_message = "Backend Offline"
                            last_api_call = time.time()
                            gate_timer = time.time()
                    else:
                        # Just hold the last status color while debouncing
                         if gate_status.startswith("PAID"):
                             box_color = (0, 255, 0)
                else:
                    box_color = (0, 255, 255) # Yellow: Face OK, Signal Missing
            
            # Draw Box
            cv2.rectangle(frame, (target_face.left(), target_face.top()), (target_face.right(), target_face.bottom()), box_color, 2)
            cv2.putText(frame, f"{face_name}", (target_face.left(), target_face.top()-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

    # --- E. UI OVERLAY ---
    # Top Bar
    cv2.rectangle(frame, (0,0), (w, 40), (20, 20, 20), -1)
    sig_text = f"BLE: {strongest_signal_name} ({max_rssi}dBm)" if strongest_signal_name != "None" else "BLE: Scanning..."
    cv2.putText(frame, sig_text, (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 1)

    # Gate Status Overlay
    if time.time() - gate_timer < 4: # Show status for 4 seconds
        bg_col = (0, 200, 0) if "PAID" in gate_status else (0, 0, 200)
        cv2.rectangle(frame, (0, h-100), (w, h), bg_col, -1)
        cv2.putText(frame, gate_status, (50, h-60), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (255,255,255), 3)
        cv2.putText(frame, display_message, (50, h-20), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)

    cv2.imshow("Metro Exit Gate", frame)
    if cv2.waitKey(1) == ord('q'): break

cap.release()
cv2.destroyAllWindows()
