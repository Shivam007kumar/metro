import uuid
import chromadb
import cv2
import dlib
import numpy as np
import os
import secrets 
import config

# ================= SETUP =================
print("\n🚇 METRO SECURE REGISTRAR (BLE COMPATIBLE)")
print("==========================================")

full_name = input("Enter Full Name: ").strip()
if not full_name:
    print("❌ Name cannot be empty.")
    exit()

# 1. Generate 16-Char Secure Token (8 Bytes)
# This fits inside the 31-byte BLE Legacy limit
secure_hash = secrets.token_hex(8).upper() 
ble_token = f"METRO-{secure_hash}"
user_uuid = str(uuid.uuid4())

print("\n-----------------------------------------")
print(f"👤 USER:      {full_name}")
print(f"🔐 TOKEN:     {secure_hash}")
print(f"📱 BLE NAME:  {ble_token}") 
print(f"📏 LENGTH:    {len(ble_token)} chars (Safe for BLE)")
print("-----------------------------------------")

# ================= AI SETUP =================
print("\n⏳ Initializing Camera & AI...")
if not os.path.exists(f"{config.MODELS_DIR}/shape_predictor_68_face_landmarks.dat"):
    print(f"❌ ERROR: Models missing.")
    exit()

detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor(f"{config.MODELS_DIR}/shape_predictor_68_face_landmarks.dat")
facerec = dlib.face_recognition_model_v1(f"{config.MODELS_DIR}/dlib_face_recognition_resnet_model_v1.dat")

client = chromadb.PersistentClient(path=config.DB_PATH)
collection = client.get_or_create_collection(name="metro_faces")

# ================= CAPTURE LOOP =================
cap = cv2.VideoCapture(config.CAMERA_INDEX)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

while True:
    ret, frame = cap.read()
    if not ret: break
    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    
    # Guide Box
    cv2.rectangle(frame, (w//2 - 150, h//2 - 200), (w//2 + 150, h//2 + 100), (0, 255, 0), 2)
    cv2.putText(frame, "ALIGN FACE + PRESS SPACE", (w//2 - 140, h//2 - 220), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)
    
    cv2.putText(frame, "Assigning ID:", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    cv2.putText(frame, ble_token, (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

    cv2.imshow("Secure Registrar", frame)
    
    key = cv2.waitKey(1)
    if key == ord('q'): break
        
    if key == 32: # SPACE BAR
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = detector(rgb, 1)
        
        if len(faces) == 1:
            shape = sp(rgb, faces[0])
            vector = list(np.array(facerec.compute_face_descriptor(rgb, shape)))
            
            collection.add(
                ids=[user_uuid],
                embeddings=[vector],
                metadatas=[{
                    "name": full_name.split()[0],
                    "full_name": full_name,
                    "cypher_id": ble_token, # 16-char secure token
                    "wallet_balance": 100
                }]
            )
            
            print(f"\n🎉 SUCCESS! {full_name} is secure.")
            print(f"👉 Set nRF Connect Local Name to: {ble_token}")
            break

cap.release()
cv2.destroyAllWindows()