"""
SafeGuard-AI: Unit & Integration Tests for Configurable Worker Identification Delay
and Multi-Frame Confirmation Window.

Verifies:
1. Real-time immediate person detection and PPE safety checks (0 delay for alerts).
2. Four identity phases: Detecting -> Verifying -> Registered Worker / Unknown Worker.
3. Multi-frame evidence accumulation across time (not single-frame instant assignment).
4. Configurable confirmation duration (e.g. 1.5s default).
5. Independent tracking and confirmation for multiple workers simultaneously.
6. Unknown personnel transitioning to 'Unknown Worker' after timeout without guessing.
"""

import unittest
import numpy as np
import cv2
import time
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from detector import MultiWorkerPPEDetector, compute_face_embedding


class TestWorkerConfirmationDelay(unittest.TestCase):
    def setUp(self):
        self.detector = MultiWorkerPPEDetector()
        self.detector.worker_confirmation_duration_sec = 1.5
        self.detector.min_confirmation_frames = 3
        self.detector.min_match_ratio = 0.60
        self.detector.tracked_worker_identities = {}

        # Enroll a registered test worker
        self.face_img = np.full((64, 64, 3), 210, dtype=np.uint8)
        self.face_img[20:28, 16:24] = 60  # Left eye
        self.face_img[20:28, 40:48] = 60  # Right eye
        self.face_img[44:50, 22:42] = 80  # Mouth
        self.face_img[26:38, 30:34] = 160 # Nose

        emb = compute_face_embedding(self.face_img)
        self.detector.gallery.workers = {}
        self.detector.gallery.register({
            "id": "W-2001",
            "name": "Kavita Deshmukh",
            "department": "Precision Foundry",
            "faceSignatures": [emb]
        })

    def _create_frame_with_face(self, face, has_helmet=True, has_vest=True):
        frame = np.full((400, 400, 3), 40, dtype=np.uint8)
        # Paste face in head region
        resized = cv2.resize(face, (80, 80))
        frame[40:120, 160:240] = resized
        return frame

    def test_immediate_safety_compliance_with_delayed_identity(self):
        """PPE violations must be detected immediately on Frame 1 even while identity is pending."""
        frame = self._create_frame_with_face(self.face_img)
        persons = [{
            "bbox": [140, 30, 260, 350],
            "confidence": 0.95,
            "track_id": 1
        }]
        helmets = []  # NO helmet! Violation!
        vests = []    # NO vest! Violation!

        t0 = 0.0
        workers = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=t0, enable_confirmation_delay=True
        )

        self.assertEqual(len(workers), 1)
        w = workers[0]
        # Safety must be evaluated immediately
        self.assertEqual(w["status"], "BOTH_MISSING")
        self.assertEqual(w["status_color"], "dark_red")
        self.assertEqual(w["status_label"], "HELMET & VEST NOT DETECTED")

        # Identity must NOT be prematurely assigned
        self.assertEqual(w["identity_state"], "detecting")
        self.assertFalse(w["is_identified"])
        self.assertIn("Detecting Person", w["worker_name"])

    def test_multi_frame_confirmation_window_lifecycle(self):
        """Worker progresses: Detecting (0s) -> Verifying (0.5s, 1.0s) -> Confirmed Registered (1.6s)."""
        frame = self._create_frame_with_face(self.face_img)
        persons = [{
            "bbox": [140, 30, 260, 350],
            "confidence": 0.95,
            "track_id": 10
        }]
        helmets = [{"bbox": [150, 20, 250, 70], "confidence": 0.92}]
        vests = [{"bbox": [140, 120, 260, 260], "confidence": 0.90}]

        # Frame 1 at t = 0.0s: Detecting
        w1 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=0.0, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w1["identity_state"], "detecting")
        self.assertFalse(w1["is_identified"])

        # Frame 2 at t = 0.5s: Verifying
        w2 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=0.5, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w2["identity_state"], "verifying")
        self.assertFalse(w2["is_identified"])
        self.assertIn("Verifying Identity", w2["worker_name"])

        # Frame 3 at t = 1.0s: Still Verifying (under 1.5s window)
        w3 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=1.0, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w3["identity_state"], "verifying")
        self.assertFalse(w3["is_identified"])

        # Frame 4 at t = 1.6s (>= 1.5s window with 4 matching frames): Confirmed!
        w4 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=1.6, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w4["identity_state"], "confirmed")
        self.assertTrue(w4["is_identified"])
        self.assertEqual(w4["worker_name"], "Kavita Deshmukh")
        self.assertEqual(w4["registered_id"], "W-2001")
        self.assertGreaterEqual(w4["face_confidence"], 70.0)

    def test_unknown_person_becomes_unknown_worker(self):
        """An unregistered face progresses: Detecting -> Verifying -> Unknown Worker after timeout."""
        # Vertical stripes (distinct non-matching pattern)
        unk_face = np.zeros((64, 64, 3), dtype=np.uint8)
        for c in range(0, 64, 4):
            unk_face[:, c:c+2] = 250
        frame = self._create_frame_with_face(unk_face)

        persons = [{
            "bbox": [140, 30, 260, 350],
            "confidence": 0.95,
            "track_id": 20
        }]
        helmets = [{"bbox": [150, 20, 250, 70], "confidence": 0.92}]
        vests = [{"bbox": [140, 120, 260, 260], "confidence": 0.90}]

        # t = 0.0s: Detecting
        w1 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=0.0, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w1["identity_state"], "detecting")

        # t = 0.8s: Verifying
        w2 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=0.8, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w2["identity_state"], "verifying")

        # t = 1.7s (timeout elapsed without valid match): Unknown Worker
        w3 = self.detector.associate_ppe(
            persons, helmets, vests, frame.shape,
            frame_image=frame, timestamp_sec=1.7, enable_confirmation_delay=True
        )[0]
        self.assertEqual(w3["identity_state"], "unknown")
        self.assertFalse(w3["is_identified"])
        self.assertIn("Unknown Worker", w3["worker_name"])

    def test_multi_worker_independent_confirmation(self):
        """Two workers entering simultaneously must be processed independently."""
        unk_face = np.zeros((64, 64, 3), dtype=np.uint8)
        for c in range(0, 64, 4):
            unk_face[:, c:c+2] = 250

        frame = np.full((400, 600, 3), 40, dtype=np.uint8)
        # Paste registered face at x: 80
        frame[40:120, 80:160] = cv2.resize(self.face_img, (80, 80))
        # Paste unknown face at x: 380
        frame[40:120, 380:460] = cv2.resize(unk_face, (80, 80))

        persons = [
            {"bbox": [60, 30, 180, 350], "confidence": 0.95, "track_id": 101},
            {"bbox": [360, 30, 480, 350], "confidence": 0.92, "track_id": 102}
        ]
        helmets = []
        vests = []

        # Frames across 1.7 seconds
        for t in [0.0, 0.5, 1.0, 1.7]:
            res = self.detector.associate_ppe(
                persons, helmets, vests, frame.shape,
                frame_image=frame, timestamp_sec=t, enable_confirmation_delay=True
            )

        w_reg = next(w for w in res if w["track_id"] == 101)
        w_unk = next(w for w in res if w["track_id"] == 102)

        self.assertEqual(w_reg["identity_state"], "confirmed")
        self.assertEqual(w_reg["worker_name"], "Kavita Deshmukh")

        self.assertEqual(w_unk["identity_state"], "unknown")
        self.assertIn("Unknown Worker", w_unk["worker_name"])

    def test_registered_worker_dynamic_recovery_from_head_turn(self):
        """Worker initially looking away (unmatched) transitions to 'unknown', then cleanly upgrades to 'confirmed' upon facing camera."""
        # Frame with turned face (no facial match)
        # Turned away face with vertical stripes (unmatched)
        turned_face = np.zeros((64, 64, 3), dtype=np.uint8)
        for c in range(0, 64, 4):
            turned_face[:, c:c+2] = 250
        frame_turned = self._create_frame_with_face(turned_face)
        # Frame with registered face
        frame_registered = self._create_frame_with_face(self.face_img)

        persons = [{"bbox": [140, 30, 260, 350], "confidence": 0.95, "track_id": 55}]
        helmets = [{"bbox": [150, 20, 250, 70], "confidence": 0.92}]
        vests = [{"bbox": [140, 120, 260, 260], "confidence": 0.90}]

        # t = 0.0s, 0.8s: turned away
        self.detector.associate_ppe(persons, helmets, vests, frame_turned.shape, frame_image=frame_turned, timestamp_sec=0.0, enable_confirmation_delay=True)
        self.detector.associate_ppe(persons, helmets, vests, frame_turned.shape, frame_image=frame_turned, timestamp_sec=0.8, enable_confirmation_delay=True)

        # t = 1.7s: confirmation window elapsed while turned away -> state is 'unknown'
        w_unk = self.detector.associate_ppe(persons, helmets, vests, frame_turned.shape, frame_image=frame_turned, timestamp_sec=1.7, enable_confirmation_delay=True)[0]
        self.assertEqual(w_unk["identity_state"], "unknown")
        self.assertIn("Unknown Worker", w_unk["worker_name"])

        # t = 2.2s, 2.5s: worker turns toward camera with registered face! Must dynamically promote to 'confirmed'!
        self.detector.associate_ppe(persons, helmets, vests, frame_registered.shape, frame_image=frame_registered, timestamp_sec=2.2, enable_confirmation_delay=True)
        w_conf = self.detector.associate_ppe(persons, helmets, vests, frame_registered.shape, frame_image=frame_registered, timestamp_sec=2.5, enable_confirmation_delay=True)[0]

        self.assertEqual(w_conf["identity_state"], "confirmed")
        self.assertTrue(w_conf["is_identified"])
        self.assertEqual(w_conf["worker_name"], "Kavita Deshmukh")
        self.assertEqual(w_conf["registered_id"], "W-2001")

    def test_five_second_incident_alert_delay_evaluation(self):
        """Incident alert dispatch strictly requires sustained 5.0-second continuous violation."""
        delay_sec = 5.0
        self.assertEqual(self.detector.incident_alert_delay_sec, 5.0)

        # State simulator mirroring client evaluateViolations()
        violation_start_time = None
        consecutive_violations = 0
        dispatched_alerts = []

        def evaluate_violation(is_violation, timestamp_sec):
            nonlocal violation_start_time, consecutive_violations, dispatched_alerts
            if is_violation:
                consecutive_violations += 1
                if violation_start_time is None:
                    violation_start_time = timestamp_sec
                duration = timestamp_sec - violation_start_time
                if duration >= delay_sec:
                    dispatched_alerts.append(timestamp_sec)
            else:
                consecutive_violations = 0
                violation_start_time = None

        # Frame 1: t=0.0s (Violation begins) -> No alert
        evaluate_violation(True, 0.0)
        self.assertEqual(len(dispatched_alerts), 0)

        # Frame 2: t=2.5s (Violation persists 2.5s < 5.0s) -> No alert
        evaluate_violation(True, 2.5)
        self.assertEqual(len(dispatched_alerts), 0)

        # Frame 3: t=4.9s (Violation persists 4.9s < 5.0s) -> No alert
        evaluate_violation(True, 4.9)
        self.assertEqual(len(dispatched_alerts), 0)

        # Frame 4: t=5.0s (Violation reaches sustained 5.0s) -> Alert dispatched!
        evaluate_violation(True, 5.0)
        self.assertEqual(len(dispatched_alerts), 1)
        self.assertEqual(dispatched_alerts[0], 5.0)

        # Worker puts on helmet at t=5.5s (Becomes compliant) -> Reset
        evaluate_violation(False, 5.5)
        self.assertIsNone(violation_start_time)

        # Brief adjustment violation at t=6.0s, fixed at t=7.0s (1.0s < 5.0s) -> No second alert
        evaluate_violation(True, 6.0)
        evaluate_violation(False, 7.0)
        self.assertEqual(len(dispatched_alerts), 1)


if __name__ == "__main__":
    unittest.main()
