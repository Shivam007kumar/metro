import os
import sys
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Depends
from pydantic import BaseModel
import cv2
import dlib
import numpy as np
import chromadb
import uuid
import base64
import secrets
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client

# ================= CONFIGURATION =================
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "chroma_db")
MODELS_PATH = os.path.join(BASE_DIR, "models")

# Supabase (for persisting enrollment + profile data)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("⚠️  WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY missing in .env")
    print("   Enrollment state will NOT persist to database.")
    sb = None
else:
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ API: Supabase connected.")

# ================= AI ENGINE SETUP =================
print("⏳ API: Loading AI Models...")
if not os.path.exists(os.path.join(MODELS_PATH, "shape_predictor_68_face_landmarks.dat")):
    print("❌ ERROR: Models missing. Check your paths.")
    sys.exit(1)

detector = dlib.get_frontal_face_detector()
sp = dlib.shape_predictor(os.path.join(MODELS_PATH, "shape_predictor_68_face_landmarks.dat"))
facerec = dlib.face_recognition_model_v1(os.path.join(MODELS_PATH, "dlib_face_recognition_resnet_model_v1.dat"))

print(f"⏳ API: Connecting to Shared DB at {DB_PATH}...")
chroma_client = chromadb.PersistentClient(path=DB_PATH)
collection = chroma_client.get_or_create_collection(name="metro_faces")
print("✅ API: Ready to Enroll.")

# ================= API INIT =================
app = FastAPI(title="Metro Enrollment Service")


# ================= AUTH DEPENDENCY =================
async def get_current_user(authorization: str = Header(...)):
    """
    Verify the Supabase JWT from the Authorization header.
    Returns the authenticated user object.
    """
    if not sb:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        # Strip "Bearer " prefix
        token = authorization.replace("Bearer ", "").strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing token")

        # Verify token with Supabase — this checks expiry, signature, etc.
        user_response = sb.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user_response.user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth failed: {str(e)}")


# ================= DATA MODELS =================
class WalletAdd(BaseModel):
    amount: int  # Amount to add (positive integer)


# ================= HELPER: HEAD POSE =================
def get_pose(shape):
    nose = shape.part(30).x
    left = shape.part(36).x
    right = shape.part(45).x
    dist_l = abs(nose - left)
    dist_r = abs(right - nose)
    if dist_r == 0: dist_r = 0.001
    ratio = dist_l / dist_r
    if ratio < 0.5: return "RIGHT"
    if ratio > 2.0: return "LEFT"
    return "CENTER"


# ================= SECURED REST ENDPOINTS =================

@app.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    """Get the authenticated user's profile from Supabase."""
    try:
        result = sb.table("profiles").select("*").eq("id", str(user.id)).single().execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


@app.post("/wallet/add")
async def add_money(body: WalletAdd, user=Depends(get_current_user)):
    """Add money to the authenticated user's wallet. Server-side only."""
    if body.amount <= 0 or body.amount > 10000:
        raise HTTPException(status_code=400, detail="Amount must be between 1 and 10000")

    try:
        # Get current balance
        profile = sb.table("profiles").select("wallet_balance").eq("id", str(user.id)).single().execute()
        current_balance = profile.data.get("wallet_balance", 0) or 0

        new_balance = current_balance + body.amount

        # Update balance
        sb.table("profiles").update({
            "wallet_balance": new_balance
        }).eq("id", str(user.id)).execute()

        return {"new_balance": new_balance, "added": body.amount}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Wallet update failed: {str(e)}")


@app.post("/confirm_enrollment")
async def confirm_enrollment(user=Depends(get_current_user)):
    """
    Fallback endpoint: if WebSocket enrollment completed but DB update failed,
    the app can call this to mark enrollment complete.
    Checks if face vectors exist in ChromaDB for this user.
    """
    user_id = str(user.id)

    # Verify that face vectors actually exist in ChromaDB
    try:
        results = collection.get(ids=[f"{user_id}_0", f"{user_id}_1", f"{user_id}_2"])
        if len(results["ids"]) < 3:
            raise HTTPException(status_code=400, detail="Face enrollment not complete. Missing face vectors.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Could not verify face enrollment.")

    # Get cypher_id from ChromaDB metadata
    try:
        result = collection.get(ids=[f"{user_id}_0"])
        cypher_id = result["metadatas"][0].get("cypher_id", "UNKNOWN")
    except Exception:
        cypher_id = f"METRO-{secrets.token_hex(8).upper()}"

    # Update Supabase
    try:
        sb.table("profiles").update({
            "is_enrolled": True,
            "cypher_id": cypher_id
        }).eq("id", user_id).execute()

        return {"status": "confirmed", "is_enrolled": True, "cypher_id": cypher_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB update failed: {str(e)}")


@app.get("/trips")
async def get_trips(user=Depends(get_current_user)):
    """Get trip history for the authenticated user."""
    try:
        result = sb.table("trips").select("*").eq(
            "user_id", str(user.id)
        ).order("entry_time", desc=True).limit(50).execute()

        return result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trips: {str(e)}")


# ================= GATE ACCESS + FARE DEDUCTION =================

class GateAccess(BaseModel):
    station_name: str      # The station where the user is tapping in
    face_data: Optional[str] = None  # Optional base64 face image for verification

# Fare table — Ghatkopar Metro Line (Mumbai Metro Line 1)
# Fare in ₹ from each station
FARE_TABLE = {
    "Versova": 10, "D.N. Nagar": 10, "Azad Nagar": 15, "Andheri": 20,
    "Western Express Highway": 20, "Chakala": 25, "Airport Road": 25,
    "Marol Naka": 30, "Saki Naka": 30, "Asalpha": 35,
    "Jagruti Nagar": 35, "Ghatkopar": 40,
}
DEFAULT_FARE = 30  # fallback if station not in table


@app.post("/gate/access")
async def gate_access(body: GateAccess, user=Depends(get_current_user)):
    """
    Gate access flow:
    1. Verify user is enrolled
    2. Optionally verify face match
    3. Check wallet balance >= fare
    4. Deduct fare
    5. Record trip
    """
    user_id = str(user.id)

    # 1. Check enrollment status
    try:
        profile = sb.table("profiles").select(
            "is_enrolled, wallet_balance, full_name, cypher_id"
        ).eq("id", user_id).single().execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile fetch failed: {str(e)}")

    if not profile.data or not profile.data.get("is_enrolled"):
        raise HTTPException(status_code=403, detail="Not enrolled. Complete face enrollment first.")

    # 2. Optional face verification (if face_data provided)
    face_matched = True
    if body.face_data:
        try:
            img_data = body.face_data
            if "," in img_data:
                img_data = img_data.split(",")[1]
            img_bytes = base64.b64decode(img_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is not None:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = detector(gray, 0)

                if len(faces) == 1:
                    shape = sp(frame, faces[0])
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    live_vector = list(np.array(facerec.compute_face_descriptor(rgb, shape)))

                    # Compare against stored vectors
                    stored = collection.get(
                        ids=[f"{user_id}_0", f"{user_id}_1", f"{user_id}_2"],
                        include=["embeddings"]
                    )

                    if stored["embeddings"]:
                        distances = [
                            np.linalg.norm(np.array(live_vector) - np.array(emb))
                            for emb in stored["embeddings"]
                        ]
                        best_distance = min(distances)
                        face_matched = best_distance < 0.6  # threshold
                    else:
                        face_matched = False
                else:
                    face_matched = False
        except Exception as e:
            print(f"⚠️  Face verification error: {e}")
            face_matched = False

    # 3. Calculate fare
    fare = FARE_TABLE.get(body.station_name, DEFAULT_FARE)
    current_balance = profile.data.get("wallet_balance", 0) or 0

    # 4. Determine access
    access_granted = face_matched and current_balance >= fare

    # 5. If access granted, deduct fare
    new_balance = current_balance
    if access_granted:
        new_balance = current_balance - fare
        try:
            sb.table("profiles").update({
                "wallet_balance": new_balance
            }).eq("id", user_id).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Fare deduction failed: {str(e)}")

    # 6. Record trip (regardless of access granted or denied)
    try:
        sb.table("trips").insert({
            "user_id": user_id,
            "station_name": body.station_name,
            "fare_charged": fare if access_granted else 0,
            "access_granted": access_granted,
            "status": "COMPLETED" if access_granted else "DENIED"
        }).execute()
    except Exception as e:
        print(f"⚠️  Trip recording failed: {e}")

    # 7. Build reason if denied
    deny_reason = None
    if not face_matched:
        deny_reason = "Face verification failed"
    elif current_balance < fare:
        deny_reason = f"Insufficient balance (₹{current_balance} < ₹{fare})"

    return {
        "access_granted": access_granted,
        "station": body.station_name,
        "fare": fare if access_granted else 0,
        "new_balance": new_balance,
        "deny_reason": deny_reason,
    }


# ================= WEBSOCKET (face enrollment stream) =================

@app.websocket("/ws/capture/{user_id}/{full_name}/{cypher_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, full_name: str, cypher_id: str):
    await websocket.accept()
    print(f"🔌 Connection: {full_name} ({user_id})")

    stages = ["CENTER", "LEFT", "RIGHT"]
    current_stage = 0

    try:
        while True:
            data = await websocket.receive_text()

            # 1. DECODE BASE64 IMAGE
            try:
                if "," in data:
                    data = data.split(",")[1]
                img_bytes = base64.b64decode(data)
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                if frame is None:
                    await websocket.send_json({"status": "RETRY", "msg": "Bad image. Try again."})
                    continue
            except Exception:
                await websocket.send_json({"status": "RETRY", "msg": "Image decode error."})
                continue

            # 2. DETECT FACE
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = detector(gray, 0)

            if len(faces) == 0:
                await websocket.send_json({"status": "GUIDE", "msg": f"No face found. Look {stages[current_stage]}"})
                continue
            if len(faces) > 1:
                await websocket.send_json({"status": "RETRY", "msg": "Multiple faces detected!"})
                continue

            face = faces[0]

            # 3. GET LANDMARKS & POSE
            shape = sp(frame, face)
            pose = get_pose(shape)
            required_pose = stages[current_stage]

            if pose == required_pose:
                # 4. GENERATE & SAVE VECTOR
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                vector = list(np.array(facerec.compute_face_descriptor(rgb, shape)))

                collection.add(
                    ids=[f"{user_id}_{current_stage}"],
                    embeddings=[vector],
                    metadatas=[{
                        "name": full_name.split()[0],
                        "full_name": full_name,
                        "cypher_id": cypher_id,
                        "angle": pose
                    }]
                )

                current_stage += 1

                if current_stage >= len(stages):
                    # 5. PERSIST ENROLLMENT TO SUPABASE
                    enrollment_saved = False
                    if sb:
                        try:
                            sb.table("profiles").update({
                                "is_enrolled": True,
                                "cypher_id": cypher_id
                            }).eq("id", user_id).execute()
                            enrollment_saved = True
                            print(f"✅ Enrolled & saved: {full_name}")
                        except Exception as e:
                            print(f"⚠️  Enrolled but DB save failed: {e}")
                    else:
                        print(f"✅ Enrolled (local only): {full_name}")

                    await websocket.send_json({
                        "status": "COMPLETE",
                        "msg": "Enrollment Complete!",
                        "saved": enrollment_saved
                    })
                    break
                else:
                    await websocket.send_json({
                        "status": "NEXT",
                        "msg": f"Good! Now look {stages[current_stage]}"
                    })
                    await asyncio.sleep(1)
            else:
                await websocket.send_json({"status": "GUIDE", "msg": f"Look {required_pose}"})

    except WebSocketDisconnect:
        print(f"🔌 Disconnected: {full_name}")
    except Exception as e:
        print(f"❌ Error: {e}")
        try:
            await websocket.send_json({"status": "RETRY", "msg": f"Server error: {str(e)}"})
        except:
            pass