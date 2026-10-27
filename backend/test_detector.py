"""
SafeGuard AI — Multi-Worker Construction PPE Detection Test Suite
Validates the exact classification rules, color coding, and acceptance criteria.
"""

import unittest
from detector import MultiWorkerPPEDetector

class TestMultiWorkerPPEDetector(unittest.TestCase):

    def setUp(self):
        self.detector = MultiWorkerPPEDetector()
        self.frame_shape = (720, 1280, 3)

    def test_01_single_worker_both_compliant(self):
        """Rule 4: Worker 1 — PPE COMPLIANT: Both helmet and vest detected (Color: Green)."""
        persons = [{"bbox": [500, 200, 700, 600], "confidence": 0.95, "track_id": 1, "name": "Pranav"}]
        helmets = [{"bbox": [530, 190, 670, 290], "confidence": 0.92}]
        vests = [{"bbox": [510, 300, 690, 520], "confidence": 0.90}]

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 1)
        self.assertEqual(workers[0]["status"], "SAFE")
        self.assertEqual(workers[0]["status_label"], "PPE COMPLIANT")
        self.assertEqual(workers[0]["status_color"], "green")
        self.assertEqual(workers[0]["worker_title"], "Pranav — PPE COMPLIANT")
        self.assertEqual(workers[0]["worker_name"], "Pranav")
        self.assertTrue(workers[0]["is_assessable"])

    def test_02_multiple_workers_both_compliant(self):
        """Multiple workers all wearing both items."""
        persons = [
            {"bbox": [100, 200, 300, 600], "confidence": 0.94, "track_id": 1},
            {"bbox": [400, 200, 600, 600], "confidence": 0.92, "track_id": 2},
            {"bbox": [700, 200, 900, 600], "confidence": 0.96, "track_id": 3}
        ]
        helmets = [
            {"bbox": [130, 190, 270, 280], "confidence": 0.91},
            {"bbox": [430, 190, 570, 280], "confidence": 0.89},
            {"bbox": [730, 190, 870, 280], "confidence": 0.93}
        ]
        vests = [
            {"bbox": [110, 300, 290, 520], "confidence": 0.90},
            {"bbox": [410, 300, 590, 520], "confidence": 0.88},
            {"bbox": [710, 300, 890, 520], "confidence": 0.94}
        ]

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 3)
        for idx, w in enumerate(workers):
            self.assertEqual(w["status"], "SAFE")
            self.assertEqual(w["status_label"], "PPE COMPLIANT")
            expected_name = f"Worker {idx+1}"
            self.assertEqual(w["worker_title"], f"{expected_name} — PPE COMPLIANT")

    def test_03_group_with_missing_helmets(self):
        """Rule 1: Worker 1 — HELMET NOT DETECTED: Vest detected, no helmet detected (Color: Red)."""
        persons = [
            {"bbox": [100, 200, 300, 600], "confidence": 0.95, "track_id": 1},
            {"bbox": [400, 200, 600, 600], "confidence": 0.91, "track_id": 2}
        ]
        helmets = [
            {"bbox": [130, 190, 270, 280], "confidence": 0.90}
            # Worker 2 has no helmet
        ]
        vests = [
            {"bbox": [110, 300, 290, 520], "confidence": 0.90},
            {"bbox": [410, 300, 590, 520], "confidence": 0.89}
        ]

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 2)
        self.assertEqual(workers[0]["status_label"], "PPE COMPLIANT")
        self.assertEqual(workers[1]["status_label"], "HELMET NOT DETECTED")
        self.assertEqual(workers[1]["status_color"], "red")
        self.assertEqual(workers[1]["worker_title"], "Worker 2 — HELMET NOT DETECTED")

    def test_04_group_with_missing_vests(self):
        """Rule 2: Worker 2 — VEST NOT DETECTED: Helmet detected, no vest detected (Color: Orange)."""
        persons = [
            {"bbox": [100, 200, 300, 600], "confidence": 0.95, "track_id": 1},
            {"bbox": [400, 200, 600, 600], "confidence": 0.91, "track_id": 2}
        ]
        helmets = [
            {"bbox": [130, 190, 270, 280], "confidence": 0.90},
            {"bbox": [430, 190, 570, 280], "confidence": 0.88}
        ]
        vests = [
            {"bbox": [110, 300, 290, 520], "confidence": 0.90}
            # Worker 2 has no vest
        ]

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 2)
        self.assertEqual(workers[0]["status_label"], "PPE COMPLIANT")
        self.assertEqual(workers[1]["status_label"], "VEST NOT DETECTED")
        self.assertEqual(workers[1]["status_color"], "orange")
        self.assertEqual(workers[1]["worker_title"], "Worker 2 — VEST NOT DETECTED")

    def test_05_workers_missing_both_items(self):
        """Rule 3: Worker 3 — HELMET & VEST NOT DETECTED: Neither helmet nor vest detected (Color: Dark Red)."""
        persons = [{"bbox": [300, 200, 500, 600], "confidence": 0.90, "track_id": 3}]
        helmets = []
        vests = []

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 1)
        self.assertEqual(workers[0]["status_label"], "HELMET & VEST NOT DETECTED")
        self.assertEqual(workers[0]["status_color"], "dark_red")
        self.assertEqual(workers[0]["worker_title"], "Worker 3 — HELMET & VEST NOT DETECTED")

    def test_06_crowded_scene_no_duplicate_assignment(self):
        """Overlapping workers where only 1 helmet is present (Greedy containment)."""
        persons = [
            {"bbox": [300, 200, 480, 600], "confidence": 0.92, "track_id": 1},
            {"bbox": [350, 200, 530, 600], "confidence": 0.90, "track_id": 2}
        ]
        helmets = [{"bbox": [320, 190, 440, 270], "confidence": 0.91}] # Centered on Worker 1
        vests = []

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 2)
        assigned_count = sum(1 for w in workers if w["helmet"]["detected"])
        self.assertEqual(assigned_count, 1)

    def test_07_distant_worker_marked_uncertain(self):
        """Rule 5: Distant worker marked UNCERTAIN / PPE NOT CLEARLY VISIBLE (Color: Yellow)."""
        persons = [{"bbox": [600, 100, 615, 135], "confidence": 0.80, "track_id": 9}] # Height 35px (< 50px)
        helmets = []
        vests = []

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 1)
        self.assertEqual(workers[0]["status_label"], "UNCERTAIN / PPE NOT CLEARLY VISIBLE")
        self.assertEqual(workers[0]["status_color"], "yellow")
        self.assertEqual(workers[0]["worker_title"], "Worker 9 — UNCERTAIN / PPE NOT CLEARLY VISIBLE")
        self.assertFalse(workers[0]["is_assessable"])

    def test_08_partially_obscured_at_edge_marked_uncertain(self):
        """Worker cut off at edge of frame marked as UNCERTAIN."""
        persons = [{"bbox": [0, 0, 120, 180], "confidence": 0.85, "track_id": 10}]
        helmets = []
        vests = []

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        self.assertEqual(len(workers), 1)
        self.assertEqual(workers[0]["status_label"], "UNCERTAIN / PPE NOT CLEARLY VISIBLE")
        self.assertEqual(workers[0]["status_color"], "yellow")

    def test_09_class_filtering_strictly_ppe_only(self):
        """Verify unrelated classes are ignored and only person/helmet/vest pass."""
        self.assertEqual(self.detector.map_class_name("hard-hat"), "helmet")
        self.assertEqual(self.detector.map_class_name("safety_vest"), "vest")
        self.assertEqual(self.detector.map_class_name("construction-worker"), "person")
        self.assertIsNone(self.detector.map_class_name("sunglasses"))
        self.assertIsNone(self.detector.map_class_name("gloves"))
        self.assertIsNone(self.detector.map_class_name("boots"))
        self.assertIsNone(self.detector.map_class_name("casual_shirt"))

    def test_10_compliance_percentage_calculation(self):
        """Verify compliance % formula excludes uncertain workers."""
        persons = [
            {"bbox": [100, 200, 300, 600], "confidence": 0.94, "track_id": 1}, # Safe
            {"bbox": [400, 200, 600, 600], "confidence": 0.92, "track_id": 2}, # Missing Helmet
            {"bbox": [700, 100, 715, 135], "confidence": 0.70, "track_id": 3}  # Distant -> Uncertain
        ]
        helmets = [{"bbox": [130, 190, 270, 280], "confidence": 0.91}]
        vests = [
            {"bbox": [110, 300, 290, 520], "confidence": 0.90},
            {"bbox": [410, 300, 590, 520], "confidence": 0.88}
        ]

        workers = self.detector.associate_ppe(persons, helmets, vests, self.frame_shape)
        compliant = sum(1 for w in workers if w["status"] == "SAFE") # 1
        uncertain = sum(1 for w in workers if w["status"] == "UNCERTAIN") # 1
        assessable = len(workers) - uncertain # 3 - 1 = 2
        compliance_pct = (compliant / assessable) * 100.0 # 1 / 2 = 50.0%

        self.assertEqual(compliant, 1)
        self.assertEqual(uncertain, 1)
        self.assertEqual(assessable, 2)
        self.assertEqual(compliance_pct, 50.0)

    def test_11_yolo_and_tracker_support(self):
        """Verify YOLO11/YOLOv8 architecture awareness and ByteTrack / BoT-SORT configuration."""
        self.assertIn(self.detector.model_type, ["yolo11", "yolov8"])
        self.detector.tracker_type = "botsort"
        self.assertEqual(self.detector.tracker_type, "botsort")
        self.detector.tracker_type = "bytetrack"
        self.assertEqual(self.detector.tracker_type, "bytetrack")

    def test_12_accuracy_validation_dataset_evaluation(self):
        """Verify benchmark evaluation calculates Precision, Recall, and PPE Accuracy."""
        sample_dataset = [
            {
                "predictions": {
                    "workers": [
                        {"person_bbox": [100, 200, 300, 600], "status": "SAFE", "helmet": {"detected": True}, "vest": {"detected": True}},
                        {"person_bbox": [400, 200, 600, 600], "status": "HELMET_MISSING", "helmet": {"detected": False}, "vest": {"detected": True}}
                    ]
                },
                "ground_truth": {
                    "workers": [
                        {"bbox": [100, 200, 300, 600], "status": "SAFE", "helmet": True, "vest": True},
                        {"bbox": [400, 200, 600, 600], "status": "HELMET_MISSING", "helmet": False, "vest": True}
                    ]
                }
            }
        ]
        metrics = self.detector.evaluate_dataset(sample_dataset)
        self.assertEqual(metrics["person_detection"]["precision"], 1.0)
        self.assertEqual(metrics["person_detection"]["recall"], 1.0)
        self.assertEqual(metrics["helmet_detection"]["precision"], 1.0)
        self.assertEqual(metrics["vest_detection"]["precision"], 1.0)
        self.assertEqual(metrics["worker_ppe_classification_accuracy"], 1.0)
        self.assertTrue(metrics["test_mode_available"])

    def test_13_test_mode_overlay_rendering(self):
        """Verify ground-truth and prediction overlay rendering."""
        import numpy as np
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        res = {
            "workers": [
                {
                    "worker_id": 1,
                    "worker_name": "Pranav",
                    "person_bbox": [100, 100, 300, 400],
                    "status": "SAFE",
                    "status_color": "green",
                    "status_label": "PPE COMPLIANT",
                    "worker_title": "Pranav — PPE COMPLIANT",
                    "helmet": {"detected": True, "confidence": 0.95, "bbox": [150, 100, 250, 180]},
                    "vest": {"detected": True, "confidence": 0.92, "bbox": [120, 180, 280, 350]}
                }
            ],
            "total_workers": 1,
            "compliant_workers": 1,
            "missing_helmet_workers": 0,
            "missing_vest_workers": 0,
            "missing_both_workers": 0,
            "uncertain_workers": 0
        }
        gt = [{"bbox": [100, 100, 300, 400], "label": "worker"}]
        annotated = self.detector.annotate_test_mode(dummy_frame, res, gt)
        self.assertEqual(annotated.shape, dummy_frame.shape)


if __name__ == "__main__":
    unittest.main()
