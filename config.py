import os

# ================= STATION IDENTITY =================
# Is this an Entry Gate or Exit Gate? 
# Logic: ENTRY checks Balance. EXIT calculates Fare.
GATE_MODE = "ENTRY"  # Options: "ENTRY", "EXIT"
STATION_NAME = "Central Terminal"
GATE_ID = "G-01"

# ================= HARDWARE CONFIG =================
# Mac/Linux: "/dev/cu.usbserial-..." or "/dev/ttyUSB0"
# Windows: "COM3"
SERIAL_PORT = "/dev/cu.usbserial-0001" 
BAUD_RATE = 115200

# ================= CAMERA CONFIG =================
CAMERA_INDEX = 0
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720
# ROI (Region of Interest) - The "Sniper Zone"
# Percentages of screen width/height
ROI_X_MIN_PCT = 0.30  # Start at 30% width
ROI_X_MAX_PCT = 0.70  # End at 70% width

# ================= AI & SECURITY TUNING =================
# How strict is the face matching? (Lower = Stricter)
# 0.40 = Bank Grade, 0.50 = Metro Grade, 0.60 = Loose
MATCH_THRESHOLD = 0.50 

# Image Quality Check
# 100 is standard. 150 is strict (needs good lighting).
BLUR_THRESHOLD = 80 

# Signal Strength Logic (Anti-Collision)
# If RSSI is lower than this (e.g., -90), ignore the phone (too far).
MIN_RSSI = -80 
# If signal hasn't been seen in X seconds, forget it.
SIGNAL_TIMEOUT = 3.0

# Database Path
DB_PATH = "chroma_db"
MODELS_DIR = "models"