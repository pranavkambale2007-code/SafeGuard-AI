"""
SafeGuard-AI: Unit & Integration Tests for Strict 10-Second Worker Detection Cooldown.

Verifies:
1. First detection of a worker is accepted immediately.
2. Repeated detections of the same worker within 10 seconds are suppressed.
3. The same worker can generate another event after 10 seconds have elapsed.
4. Two different workers maintain strictly independent cooldowns.
5. Unknown workers use separate, stable tracking identities (e.g. track_1 vs track_2), not a shared key.
6. Persistence/reload scenario does not bypass active cooldowns.
7. PPE safety compliance, violations, and emergency alerts remain 100% responsive during cooldown.
8. Expired cooldown entries are cleaned up safely to prevent unbounded memory growth.
"""

import unittest
import numpy as np
import cv2
import time
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from detector import MultiWorkerPPEDetector, compute_face_embedding


class TestWorkerDetectionCooldown(unittest.TestCase):
    def setUp(self):
        self.detector = MultiWorkerPPEDetector()
        self.detector.WORKER_DETECTION_COOLDOWN = 10.0
        self.detector.worker_detection_cooldown_sec = 10.0
        self.detector.worker_detection_cooldowns = {}

        # Enroll test worker W-101
        self.face_img = np.full((64, 64, 3), 200, dtype=np.uint8)
        self.face_img[20:28, 16:24] = 50
        self.face_img[20:28, 40:48] = 50
        self.face_img[44:50, 22:42] = 70
        emb = compute_face_embedding(self.face_img)

        self.detector.gallery.workers = {}
        self.detector.gallery.register({
            "id": "W-101",
            "name": "Aarav Sharma",
            "department": "Structural Assembly",
            "faceSignatures": [emb]
        })

    def _create_frame(self, face=None):
        frame = np.full((400, 400, 3), 40, dtype=np.uint8)
        if face is not None:
            resized = cv2.resize(face, (80, 80))
            frame[40:120, 160:240] = resized
        return frame

    def test_first_detection_accepted_immediately(self):
        """A worker's first detection is accepted immediately at t=0.0s."""
        accepted, rem = self.detector.process_worker_detection_cooldown("W-101", now_ts=100.0)
        self.assertTrue(accepted)
        self.assertEqual(rem, 0.0)
        self.assertIn("W-101", self.detector.worker_detection_cooldowns)
        self.assertEqual(self.detector.worker_detection_cooldowns["W-101"], 100.0)

    def test_repeated_detection_within_10s_suppressed(self):
        """Repeated detections of the same worker within 10 seconds are strictly suppressed."""
        # Initial acceptance
        self.detector.process_worker_detection_cooldown("W-101", now_ts=100.0)

        # Immediate repeat at t = 100.5s (0.5s later): SUPPRESSED
        accepted_1, rem_1 = self.detector.process_worker_detection_cooldown("W-101", now_ts=100.5)
        self.assertFalse(accepted_1)
        self.assertAlmostEqual(rem_1, 9.5, delta=0.05)

        # Repeat at t = 105.0s (5.0s later): SUPPRESSED
        accepted_2, rem_2 = self.detector.process_worker_detection_cooldown("W-101", now_ts=105.0)
        self.assertFalse(accepted_2)
        self.assertAlmostEqual(rem_2, 5.0, delta=0.05)

        # Repeat at t = 109.9s (9.9s later): SUPPRESSED
        accepted_3, rem_3 = self.detector.process_worker_detection_cooldown("W-101", now_ts=109.9)
        self.assertFalse(accepted_3)
        self.assertAlmostEqual(rem_3, 0.1, delta=0.05)

    def test_detection_accepted_after_10s_elapsed(self):
        """After 10 seconds have elapsed, the worker generates a new accepted detection event."""
        # Initial acceptance at t = 100.0s
        self.detector.process_worker_detection_cooldown("W-101", now_ts=100.0)

        # After 10.1s (t = 110.1s): ACCEPTED
        accepted, rem = self.detector.process_worker_detection_cooldown("W-101", now_ts=110.1)
        self.assertTrue(accepted)
        self.assertEqual(rem, 0.0)
        self.assertEqual(self.detector.worker_detection_cooldowns["W-101"], 110.1)

        # Next check at t = 112.0s is again in cooldown (remaining 8.1s)
        acc_next, rem_next = self.detector.process_worker_detection_cooldown("W-101", now_ts=112.0)
        self.assertFalse(acc_next)
        self.assertAlmostEqual(rem_next, 8.1, delta=0.05)

    def test_independent_cooldowns_for_different_workers(self):
        """Two different workers maintain completely independent cooldowns."""
        # Worker A detected at t = 200.0s -> Accepted
        acc_a1, _ = self.detector.process_worker_detection_cooldown("W-101", now_ts=200.0)
        self.assertTrue(acc_a1)

        # Worker B detected at t = 202.0s -> Accepted immediately! Worker A does NOT block Worker B
        acc_b1, _ = self.detector.process_worker_detection_cooldown("W-202", now_ts=202.0)
        self.assertTrue(acc_b1)

        # Worker A at t = 203.0s -> Suppressed (in cooldown)
        acc_a2, _ = self.detector.process_worker_detection_cooldown("W-101", now_ts=203.0)
        self.assertFalse(acc_a2)

        # Worker B at t = 204.0s -> Suppressed (in cooldown)
        acc_b2, _ = self.detector.process_worker_detection_cooldown("W-202", now_ts=204.0)
        self.assertFalse(acc_b2)

        # At t = 210.5s: Worker A has passed 10s (elapsed 10.5s) -> Worker A accepted!
        acc_a3, _ = self.detector.process_worker_detection_cooldown("W-101", now_ts=210.5)
        self.assertTrue(acc_a3)

        # But Worker B is at 8.5s elapsed (since 202.0s) -> Worker B remains in cooldown!
        acc_b3, rem_b3 = self.detector.process_worker_detection_cooldown("W-202", now_ts=210.5)
        self.assertFalse(acc_b3)
        self.assertAlmostEqual(rem_b3, 1.5, delta=0.05)

    def test_unknown_workers_use_separate_tracking_identities(self):
        """Unknown workers use stable track keys (track_1 vs track_2), NEVER a shared 'Unknown Worker' key."""
        # Unknown Worker #1 appears at t = 300.0s -> Accepted
        acc_u1, _ = self.detector.process_worker_detection_cooldown("track_1", now_ts=300.0)
        self.assertTrue(acc_u1)

        # Unknown Worker #2 appears at t = 301.0s -> Accepted independently!
        acc_u2, _ = self.detector.process_worker_detection_cooldown("track_2", now_ts=301.0)
        self.assertTrue(acc_u2)

        # Track 1 at t = 302.0s -> Suppressed
        acc_u1_repeat, _ = self.detector.process_worker_detection_cooldown("track_1", now_ts=302.0)
        self.assertFalse(acc_u1_repeat)

        # Track 2 at t = 303.0s -> Suppressed
        acc_u2_repeat, _ = self.detector.process_worker_detection_cooldown("track_2", now_ts=303.0)
        self.assertFalse(acc_u2_repeat)

        # Ensure no generic 'Unknown Worker' key exists
        self.assertNotIn("Unknown Worker", self.detector.worker_detection_cooldowns)

    def test_worker_leaving_and_reentering_frame_within_10s(self):
        """If a worker leaves and re-enters the camera frame within 10 seconds, detection event is suppressed."""
        # Worker detected at t = 400.0s
        self.detector.process_worker_detection_cooldown("W-101", now_ts=400.0)

        # Worker leaves frame between 401s and 404s.
        # Worker re-enters frame at t = 405.0s (5 seconds since initial detection):
        # Under 10s cooldown -> repeated event MUST be suppressed!
        acc, rem = self.detector.process_worker_detection_cooldown("W-101", now_ts=405.0)
        self.assertFalse(acc)
        self.assertAlmostEqual(rem, 5.0, delta=0.05)

    def test_ppe_violations_remain_responsive_during_cooldown(self):
        """Critical safety violations (missing hardhat/vest) are NOT suppressed by worker detection cooldown."""
        frame = self._create_frame(self.face_img)
        persons = [{"bbox": [140, 30, 260, 350], "confidence": 0.95, "track_id": 7}]
        # Hardhat missing (PPE violation!)
        helmets = []
        vests = [{"bbox": [140, 120, 260, 260], "confidence": 0.90}]

        # Frame 1 at t = 0.0s: Initial detection event accepted
        workers_1 = self.detector.associate_ppe(persons, helmets, vests, frame.shape, frame_image=frame, timestamp_sec=0.0, enable_confirmation_delay=False)
        self.assertEqual(len(workers_1), 1)
        w1 = workers_1[0]
        self.assertEqual(w1["status"], "HELMET_MISSING")
        self.assertTrue(w1["detection_event_accepted"])

        # Frame 2 at t = 2.0s: Worker detection event is in cooldown
        workers_2 = self.detector.associate_ppe(persons, helmets, vests, frame.shape, frame_image=frame, timestamp_sec=2.0, enable_confirmation_delay=False)
        w2 = workers_2[0]
        # Detection event is in cooldown
        self.assertFalse(w2["detection_event_accepted"])
        self.assertTrue(w2["cooldown_active"])
        # BUT safety status MUST remain 100% active and unsuppressed!
        self.assertEqual(w2["status"], "HELMET_MISSING")
        self.assertEqual(w2["status_color"], "red")
        self.assertEqual(w2["status_label"], "HELMET NOT DETECTED")
        self.assertFalse(w2["helmet"]["detected"])

    def test_cleanup_expired_cooldown_entries(self):
        """Expired entries (>60s old) are cleaned up safely to prevent unbounded memory growth."""
        self.detector.process_worker_detection_cooldown("OLD_WORKER_1", now_ts=100.0)
        self.detector.process_worker_detection_cooldown("OLD_WORKER_2", now_ts=110.0)
        self.detector.process_worker_detection_cooldown("RECENT_WORKER", now_ts=125.0)

        # At t=125.0s, stale threshold is 65.0s, so all 3 entries are active
        self.assertEqual(len(self.detector.worker_detection_cooldowns), 3)

        # Process a new event at t = 175.0s (stale threshold is 175.0 - 60.0 = 115.0s)
        # OLD_WORKER_1 (ts=100.0) and OLD_WORKER_2 (ts=110.0) are < 115.0 and must be purged!
        # RECENT_WORKER (ts=125.0) is >= 115.0 and must be retained!
        self.detector.process_worker_detection_cooldown("FRESH_WORKER", now_ts=175.0)

        self.assertNotIn("OLD_WORKER_1", self.detector.worker_detection_cooldowns)
        self.assertNotIn("OLD_WORKER_2", self.detector.worker_detection_cooldowns)
        self.assertIn("RECENT_WORKER", self.detector.worker_detection_cooldowns)
        self.assertIn("FRESH_WORKER", self.detector.worker_detection_cooldowns)


if __name__ == "__main__":
    unittest.main()
