import unittest
import numpy as np
import tempfile
import os
import json
import cv2
from detector import (
    WorkerGallery, 
    compute_face_embedding, 
    compare_face_embeddings,
    MultiWorkerPPEDetector
)

class TestWorkerGalleryAndRecognition(unittest.TestCase):
    def setUp(self):
        # Create temp db with valid json [] for testing
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
        self.temp_file.write(b"[]")
        self.temp_file.close()
        self.gallery = WorkerGallery(db_path=self.temp_file.name)

    def tearDown(self):
        if os.path.exists(self.temp_file.name):
            os.remove(self.temp_file.name)

    def test_embedding_computation_and_comparison(self):
        # Structured face template: skin tone, eyes, nose, mouth
        face1 = np.full((64, 64, 3), 130, dtype=np.uint8)
        # Eyes (dark horizontal blocks)
        face1[20:28, 14:26] = [40, 30, 20]
        face1[20:28, 38:50] = [40, 30, 20]
        # Nose bridge
        face1[26:40, 30:34] = [170, 150, 140]
        # Mouth
        face1[46:52, 22:42] = [80, 40, 40]

        # Same face under lighting change (+15 luma)
        face2 = np.clip(face1.astype(np.int32) + 15, 0, 255).astype(np.uint8)

        # Distinct image with vertical grating (completely different structure)
        face_different = np.zeros((64, 64, 3), dtype=np.uint8)
        for col in range(0, 64, 4):
            face_different[:, col:col+2] = 240

        emb1 = compute_face_embedding(face1)
        emb2 = compute_face_embedding(face2)
        emb_diff = compute_face_embedding(face_different)

        self.assertIsNotNone(emb1)
        self.assertIsNotNone(emb2)
        self.assertIsNotNone(emb_diff)
        self.assertEqual(len(emb1), 640)

        # Self-similarity must be ~1.0
        self_sim = compare_face_embeddings(emb1, emb1)
        self.assertAlmostEqual(self_sim, 1.0, places=2)

        # Same face under lighting change should match strongly (>= 0.85)
        same_sim = compare_face_embeddings(emb1, emb2)
        self.assertGreater(same_sim, 0.85)

        # Completely different structure should have low similarity (< 0.70)
        diff_sim = compare_face_embeddings(emb1, emb_diff)
        self.assertLess(diff_sim, 0.70)

    def test_worker_registration_and_recognition(self):
        face_img = np.full((64, 64, 3), 140, dtype=np.uint8)
        face_img[20:28, 14:26] = [30, 30, 30]
        face_img[20:28, 38:50] = [30, 30, 30]
        emb = compute_face_embedding(face_img)

        # Register worker via worker_dict
        success, msg, worker = self.gallery.register({
            "id": "W-9099",
            "name": "Rahul Sharma",
            "department": "Electrical Maintenance",
            "trainingStatus": "Certified (Level 3)",
            "faceSignatures": [emb]
        })

        self.assertTrue(success)
        self.assertEqual(worker["id"], "W-9099")
        self.assertEqual(worker["name"], "Rahul Sharma")
        self.assertIn("W-9099", self.gallery.workers)

        # Query gallery
        all_workers = self.gallery.get_all()
        self.assertEqual(len(all_workers), 1)
        self.assertEqual(all_workers[0]["id"], "W-9099")

        # Recognize with matching face embedding
        match_result = self.gallery.recognize(emb, threshold=0.72)
        self.assertTrue(match_result["matched"])
        self.assertEqual(match_result["worker_id"], "W-9099")
        self.assertEqual(match_result["worker_name"], "Rahul Sharma")
        self.assertGreaterEqual(match_result["similarity"], 0.99)

        # Query with unknown face (vertical bars)
        unknown_face = np.zeros((64, 64, 3), dtype=np.uint8)
        for c in range(0, 64, 4):
            unknown_face[:, c:c+2] = 230

        no_match = self.gallery.recognize(unknown_face, threshold=0.72)
        self.assertFalse(no_match["matched"])
        self.assertEqual(no_match["worker_id"], "UNKNOWN")
        self.assertEqual(no_match["worker_name"], "Unknown Worker")

    def test_worker_deletion(self):
        face = np.full((64, 64, 3), 120, dtype=np.uint8)
        face[10:30, 10:30] = 200
        emb = compute_face_embedding(face)

        success, msg, worker = self.gallery.register({
            "id": "W-101",
            "name": "Test Worker",
            "department": "Logistics",
            "faceSignatures": [emb]
        })
        self.assertTrue(success)
        self.assertIn("W-101", self.gallery.workers)
        
        deleted = self.gallery.delete("W-101")
        self.assertTrue(deleted)
        self.assertNotIn("W-101", self.gallery.workers)

        # Deleting non-existent returns False
        self.assertFalse(self.gallery.delete("W-999"))

    def test_multi_worker_ppe_detector_with_gallery(self):
        detector = MultiWorkerPPEDetector()
        detector.gallery = self.gallery

        face = np.full((64, 64, 3), 140, dtype=np.uint8)
        face[20:28, 14:26] = [30, 30, 30]
        face[20:28, 38:50] = [30, 30, 30]
        face[46:52, 22:42] = [70, 30, 30]
        emb = compute_face_embedding(face)

        self.gallery.register({
            "id": "W-5001",
            "name": "Pooja Patil",
            "department": "Welding",
            "faceSignatures": [emb]
        })

        # Person detection with head crop matching Pooja
        persons = [{
            "track_id": 1,
            "bbox": [50, 50, 250, 450],
            "person_bbox": [50, 50, 250, 450],
            "confidence": 0.92,
            "class_name": "person",
            "head_bbox": [80, 60, 180, 160],
            "torso_bbox": [60, 160, 240, 320]
        }]

        # Create synthetic full frame
        frame = np.full((500, 500, 3), 50, dtype=np.uint8)
        # Paste matching face in head region
        resized_face = cv2.resize(face, (100, 100))
        frame[60:160, 80:180] = resized_face

        # Associate PPE
        helmets = []
        vests = []
        workers = detector.associate_ppe(persons, helmets, vests, frame.shape, frame_image=frame)

        self.assertEqual(len(workers), 1)
        w = workers[0]
        self.assertEqual(w["worker_id"], 1)
        self.assertEqual(w["worker_name"], "Pooja Patil")
        self.assertEqual(w["registered_id"], "W-5001")
        self.assertTrue(w["is_identified"])
        self.assertGreaterEqual(w["face_confidence"], 72)

if __name__ == "__main__":
    unittest.main()
