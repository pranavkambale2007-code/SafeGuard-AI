# SafeGuard AI — Multi-Worker Construction PPE Detection Backend

Production-grade Python FastAPI backend integrating **Ultralytics YOLOv8**, **ByteTrack Multi-Object Tracking**, and **Spatial PPE Association** for industrial safety compliance.

---

## 1. Features
- **Multi-Worker Detection**: Identifies 1, 5, 10, 20+ workers simultaneously in high-density construction environments.
- **Strict PPE Focus**: Detects exclusively **Safety Helmet (Hardhat)** and **High-Visibility Safety Vest**. Unrelated items and general clothing are ignored.
- **Worker-by-Worker Assessment**: Assigns separate bounding boxes and evaluates compliance (`SAFE`, `HELMET MISSING`, `VEST MISSING`, `BOTH MISSING`, `UNCERTAIN`).
- **ByteTrack Tracking**: Assigns stable temporary worker IDs across video frames.
- **Spatial Overlap Association**: Uses anatomical region intersection (upper head 35% for helmets, torso 20%-70% for vests) with Hungarian-style single-assignment logic.
- **Uncertainty Guard**: Workers distant (< 50px) or clipped at frame boundaries are tagged `UNCERTAIN` and excluded from the compliance calculation denominator.
- **CORS Enabled**: Seamlessly connects with both local servers and static GitHub Pages deployments.

---

## 2. Prerequisites & Installation

### Step 1: Install Python 3.9 - 3.11
Ensure Python is installed:
```bash
python --version
pip --version
```

### Step 2: Install Dependencies
Navigate to the `backend/` directory:
```bash
cd backend
pip install -r requirements.txt
```

---

## 3. Model Weights Setup

Run the automatic model downloader:
```bash
python download_model.py
```

### Using Custom / Fine-Tuned Weights
If you have custom trained YOLOv8 weights on a construction dataset (e.g., Roboflow Construction Safety, SHWD):
1. Place your `.pt` file inside `backend/weights/yolov8n_ppe.pt`.
2. The class names will be automatically mapped to `person`, `helmet`, and `vest`.

---

## 4. Running the Server Locally

Start the FastAPI server on port 8000:
```bash
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

- **Interactive API Documentation (Swagger)**: http://127.0.0.1:8000/docs
- **Health Check**: http://127.0.0.1:8000/api/health

---

## 5. Running the Test Suite

Execute the 10 acceptance criteria unit tests:
```bash
python test_detector.py
```

---

## 6. API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Healthcheck and model status |
| `GET` | `/api/model-info` | Active model classes and tracking info |
| `POST` | `/api/settings` | Update confidence and IoU thresholds |
| `POST` | `/api/detect/image` | Process single image upload (JPG/PNG) |
| `POST` | `/api/detect/frame` | Process webcam frame (base64 stream) |
| `POST` | `/api/detect/video` | Process MP4 video file with ByteTrack tracking |
| `POST` | `/api/cctv/start` | Register RTSP / MJPEG CCTV stream securely |

---

## 7. Cloud Deployment (Connecting to GitHub Pages)

Since GitHub Pages only hosts static frontend files, host this backend on any cloud provider:

### Option A: Railway / Render (Recommended Free/Low Cost)
1. Fork or push the `backend/` directory to GitHub.
2. In Railway or Render, create a new Web Service pointing to the repository.
3. Set Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Copy your assigned public URL (e.g. `https://safeguard-ai-backend.up.railway.app`).
5. Open your GitHub Pages site, click **API Settings**, and enter your cloud URL.

### Option B: Docker Container
```dockerfile
FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```
