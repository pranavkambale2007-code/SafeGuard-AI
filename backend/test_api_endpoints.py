import unittest
import numpy as np
import base64
import cv2
import tempfile
import os
from fastapi.testclient import TestClient
from app import app, detector
from detector import compute_face_embedding

class TestWorkerAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        # Save a clean temp database for tests
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        self.temp_file.write(b"[]")
        self.temp_file.close()
        detector.gallery.db_path = self.temp_file.name
        detector.gallery.workers = {}

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            os.remove(self.temp_file.name)

    def test_get_workers_empty(self):
        res = self.client.get("/api/workers")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["count"], 0)
        self.assertEqual(data["workers"], [])

    def test_register_and_recognize_worker(self):
        # Create test face
        face = np.full((64, 64, 3), 130, dtype=np.uint8)
        face[20:28, 14:26] = [40, 30, 20]
        face[20:28, 38:50] = [40, 30, 20]
        face[46:52, 22:42] = [80, 40, 40]
        emb = compute_face_embedding(face)

        _, buf = cv2.imencode(".jpg", face)
        b64_face = "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")

        # 1. Register worker
        payload = {
            "id": "W-9901",
            "name": "Sunil Joshi",
            "department": "Assembly Operations",
            "shift": "Morning (06:00 - 14:00)",
            "trainingStatus": "Certified (Level 3)",
            "faceImage": b64_face,
            "faceSignatures": [emb]
        }

        res = self.client.post("/api/workers/register", json=payload)
        self.assertEqual(res.status_code, 200)
        reg_data = res.json()
        self.assertEqual(reg_data["status"], "success")
        self.assertEqual(reg_data["worker_id"], "W-9901")

        # 2. Verify worker appears in GET /api/workers
        res_list = self.client.get("/api/workers")
        self.assertEqual(res_list.status_code, 200)
        workers_list = res_list.json()["workers"]
        self.assertEqual(len(workers_list), 1)
        self.assertEqual(workers_list[0]["name"], "Sunil Joshi")

        # 3. Recognize with matching face
        rec_res = self.client.post("/api/workers/recognize", json={"image_base64": b64_face, "threshold": 0.72})
        self.assertEqual(rec_res.status_code, 200)
        match_data = rec_res.json()
        self.assertTrue(match_data["matched"])
        self.assertEqual(match_data["worker_id"], "W-9901")
        self.assertEqual(match_data["worker_name"], "Sunil Joshi")

        # 4. Recognize with unknown image (vertical stripes)
        unk = np.zeros((64, 64, 3), dtype=np.uint8)
        for c in range(0, 64, 4):
            unk[:, c:c+2] = 250
        _, unk_buf = cv2.imencode(".jpg", unk)
        unk_b64 = "data:image/jpeg;base64," + base64.b64encode(unk_buf).decode("utf-8")

        rec_unk = self.client.post("/api/workers/recognize", json={"image_base64": unk_b64, "threshold": 0.72})
        self.assertEqual(rec_unk.status_code, 200)
        unk_match = rec_unk.json()
        self.assertFalse(unk_match["matched"])
        self.assertEqual(unk_match["worker_id"], "UNKNOWN")
        self.assertEqual(unk_match["worker_name"], "Unknown Worker")

        # 5. Delete worker
        del_res = self.client.delete("/api/workers/W-9901")
        self.assertEqual(del_res.status_code, 200)

        # 6. Verify deleted
        res_after = self.client.get("/api/workers")
        self.assertEqual(res_after.json()["count"], 0)

if __name__ == "__main__":
    unittest.main()
