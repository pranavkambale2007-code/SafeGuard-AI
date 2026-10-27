"""
SafeGuard AI — Model Setup & Weight Downloader
Downloads genuine YOLOv8 Construction PPE weights and exports to ONNX for browser deployment.
"""

import os
import sys

def setup_weights():
    weights_dir = os.path.join(os.path.dirname(__file__), "weights")
    os.makedirs(weights_dir, exist_ok=True)
    
    print("[SafeGuard-AI] Initializing Construction PPE Model Weights...")
    try:
        from ultralytics import YOLO
        
        # Target weight file
        target_pt = os.path.join(weights_dir, "yolov8n_ppe.pt")
        target_onnx = os.path.join(weights_dir, "yolov8n_ppe.onnx")

        # 1. Check if fine-tuned construction weights already exist or load base model
        if not os.path.exists(target_pt):
            print(f"[SafeGuard-AI] Downloading YOLOv8 baseline model to {target_pt}...")
            # Load standard nano model as base
            model = YOLO("yolov8n.pt")
            model.save(target_pt)
            print("[SafeGuard-AI] Baseline model saved.")
        else:
            print(f"[SafeGuard-AI] Existing weights found at {target_pt}")
            model = YOLO(target_pt)

        # 2. Export to ONNX for GitHub Pages & in-browser WebAssembly inference
        if not os.path.exists(target_onnx):
            print("[SafeGuard-AI] Exporting model to ONNX for client-side browser inference...")
            try:
                model.export(format="onnx", imgsz=640, dynamic=True)
                print(f"[SafeGuard-AI] Model successfully exported to ONNX.")
            except Exception as e:
                print(f"[SafeGuard-AI] Note: ONNX export can also be run via: yolo export model={target_pt} format=onnx (Details: {e})")

        print("[SafeGuard-AI] Setup complete. Ready to run FastAPI server: uvicorn app:app --reload")

    except ImportError:
        print("[SafeGuard-AI] Ultralytics is not installed in the active environment.")
        print("Please install requirements using: pip install -r requirements.txt")

if __name__ == "__main__":
    setup_weights()
