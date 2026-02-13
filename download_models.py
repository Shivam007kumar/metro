import urllib.request
import bz2
import os
import ssl
import sys

# Bypass SSL errors
ssl._create_default_https_context = ssl._create_unverified_context

def download_file(url, filename):
    print(f"⬇️  Downloading {filename}...")
    
    # Download with progress indicator
    def progress(count, block_size, total_size):
        percent = int(count * block_size * 100 / total_size)
        sys.stdout.write(f"\r   ⏳ Progress: {percent}%")
        sys.stdout.flush()

    try:
        urllib.request.urlretrieve(url, filename + ".bz2", reporthook=progress)
        print("\n   📦 Extracting...")
        
        # Extract .bz2
        with bz2.BZ2File(filename + ".bz2") as fr, open(filename, "wb") as fw:
            fw.write(fr.read())
        
        # Cleanup
        os.remove(filename + ".bz2")
        print("   ✅ Done.")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")

if not os.path.exists("models"):
    os.makedirs("models")

# 1. Shape Predictor (GitHub Mirror)
if not os.path.exists("models/shape_predictor_68_face_landmarks.dat"):
    download_file(
        "https://github.com/davisking/dlib-models/raw/master/shape_predictor_68_face_landmarks.dat.bz2",
        "models/shape_predictor_68_face_landmarks.dat"
    )

# 2. ResNet (GitHub Mirror)
if not os.path.exists("models/dlib_face_recognition_resnet_model_v1.dat"):
    download_file(
        "https://github.com/davisking/dlib-models/raw/master/dlib_face_recognition_resnet_model_v1.dat.bz2",
        "models/dlib_face_recognition_resnet_model_v1.dat"
    )

print("\n🎉 Ready! Run 'python main.py'")