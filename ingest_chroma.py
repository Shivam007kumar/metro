import cv2
import dlib
import numpy as np
import os
import chromadb
import uuid
import time
from faker import Faker
from tqdm import tqdm

# ================= CONFIGURATION =================
VIP_FOLDER = "dataset"       # Where 'shivam.jpg' is
CROWD_FOLDER = "datasetog"   # Where the 7000 images are
DB_PATH = "chroma_db"
CROWD_LIMIT = 1000           # 🚀 Stop after 1000 crowd faces

# ================= SETUP =================
fake = Faker('en_IN') # Indian Names for realism
print(f"⏳ Loading AI Models...")
detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor("models/shape_predictor_68_face_landmarks.dat")
facerec = dlib.face_recognition_model_v1("models/dlib_face_recognition_resnet_model_v1.dat")

print(f"⏳ Connecting to ChromaDB...")
client = chromadb.PersistentClient(path=DB_PATH)

# Wipe old data for a clean start
try:
    client.delete_collection("metro_faces")
    print("   🗑️  Old database wiped.")
except:
    pass

collection = client.get_or_create_collection(name="metro_faces")

# ================= PHASE 1: THE VIP (You) =================
print(f"🚀 Phase 1: Ingesting VIPs from '{VIP_FOLDER}'...")

if os.path.exists(VIP_FOLDER):
    vip_files = [f for f in os.listdir(VIP_FOLDER) if f.lower().endswith(('.jpg', '.png'))]
    
    for filename in vip_files:
        path = os.path.join(VIP_FOLDER, filename)
        
        # Logic: Filename "shivam.jpg" -> Name "Shivam"
        name = os.path.splitext(filename)[0] # "shivam"
        clean_name = name.title()            # "Shivam"
        ble_token = f"METRO-{clean_name}"    # "METRO-Shivam"
        
        try:
            img = cv2.imread(path)
            if img is None: continue
            
            # Convert
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            faces = detector(rgb, 1)
            
            if len(faces) > 0:
                face = max(faces, key=lambda rect: rect.width() * rect.height())
                shape = sp(rgb, face)
                vector = list(np.array(facerec.compute_face_descriptor(rgb, shape)))
                
                collection.add(
                    ids=[str(uuid.uuid4())],
                    embeddings=[vector],
                    metadatas=[{
                        "name": clean_name,
                        "full_name": clean_name + " (Admin)",
                        "cypher_id": ble_token,
                        "type": "VIP"
                    }]
                )
                print(f"   👑 VIP ADDED: {clean_name} | Token: {ble_token}")
        except Exception as e:
            print(f"   ⚠️ Error processing VIP: {e}")
else:
    print(f"   ⚠️ Warning: Folder '{VIP_FOLDER}' not found.")

# ================= PHASE 2: THE CROWD (1000 Real Faces) =================
print(f"\n🚀 Phase 2: Ingesting {CROWD_LIMIT} Crowd Faces from '{CROWD_FOLDER}'...")

if not os.path.exists(CROWD_FOLDER):
    print(f"❌ Error: Folder '{CROWD_FOLDER}' not found!")
    exit()

crowd_files = [f for f in os.listdir(CROWD_FOLDER) if f.lower().endswith(('.jpg', '.png'))]
crowd_files.sort() # Ensure consistency

success_count = 0
pbar = tqdm(total=CROWD_LIMIT, desc="Processing Crowd")

for filename in crowd_files:
    if success_count >= CROWD_LIMIT:
        break
        
    path = os.path.join(CROWD_FOLDER, filename)
    
    try:
        img = cv2.imread(path)
        if img is None: continue
        
        # Optimization: Resize huge images to max 800px width
        if img.shape[1] > 800:
            scale = 800 / img.shape[1]
            img = cv2.resize(img, (0,0), fx=scale, fy=scale)
            
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        faces = detector(rgb, 1)
        
        if len(faces) > 0:
            face = max(faces, key=lambda rect: rect.width() * rect.height())
            shape = sp(rgb, face)
            vector = list(np.array(facerec.compute_face_descriptor(rgb, shape)))
            
            # Generate Random Identity for this Stranger
            fake_name = fake.first_name() # e.g. "Rohan"
            fake_full = f"{fake_name} {fake.last_name()}"
            fake_token = f"METRO-{fake_name}"
            
            collection.add(
                ids=[str(uuid.uuid4())],
                embeddings=[vector],
                metadatas=[{
                    "name": fake_name,
                    "full_name": fake_full,
                    "cypher_id": fake_token,
                    "type": "CROWD"
                }]
            )
            success_count += 1
            pbar.update(1)
            
    except Exception as e:
        pass

pbar.close()

print(f"\n🎉 DONE! Database Stats:")
print(f"   - Total Profiles: {collection.count()}")
print(f"   - VIPs: {len(vip_files)}")
print(f"   - Crowd: {success_count}")
print("🚀 Run 'python main.py' to test performance.")