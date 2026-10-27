/**
 * SafeGuard AI — Live Monitoring Controller
 * Handles 2x3 camera grid simulation, AI bounding boxes, AI metrics, and Chart.js PPE compliance charts.
 */

let ppeDayChart = null;
let ppeZoneChart = null;
let ppeShiftChart = null;

document.addEventListener("DOMContentLoaded", () => {
  renderMonitoringMetrics();
  initPPECharts();
  startCameraClock();

  // Initialize Live AI PPE Camera Detector
  if (window.LiveCameraDetector) {
    LiveCameraDetector.init({
      videoId: "live-camera-video",
      canvasId: "live-camera-canvas"
    });
  }

  // Initialize Multi-Angle Face Visibility Detector
  if (window.MultiAngleFaceDetector) {
    MultiAngleFaceDetector.init({
      videoId: "live-camera-video",
      canvasId: "live-camera-canvas"
    });
  }

  // Listen for state changes
  window.addEventListener("safeguard_state_changed", () => {
    renderMonitoringMetrics();
    updatePPECharts();
  });
});

// Update AI metrics display
function renderMonitoringMetrics() {
  const state = SafeGuardState.getState();
  const m = state.aiDetectionMetrics;

  const detToday = document.getElementById("ai-detections-today");
  if (detToday) detToday.textContent = m.detectionsToday.toLocaleString();

  const violations = document.getElementById("ai-violations-today");
  if (violations) violations.textContent = m.safetyViolations.toLocaleString();

  const critical = document.getElementById("ai-critical-detections");
  if (critical) critical.textContent = m.criticalDetections.toLocaleString();

  const confidence = document.getElementById("ai-confidence-score");
  if (confidence) confidence.textContent = `${m.aiConfidence}%`;

  const ppeHelmet = document.getElementById("ppe-helmet-val");
  if (ppeHelmet) ppeHelmet.textContent = `${state.ppeComplianceDetailed.helmet}%`;

  const ppeVest = document.getElementById("ppe-vest-val");
  if (ppeVest) ppeVest.textContent = `${state.ppeComplianceDetailed.vest}%`;

  const ppeOverall = document.getElementById("ppe-overall-val");
  if (ppeOverall) ppeOverall.textContent = `${state.ppeComplianceDetailed.overall}%`;
}

// Live Camera HUD Clock
function startCameraClock() {
  function updateHUDs() {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(Math.floor(now.getMilliseconds() / 100)).padStart(2, '0');
    document.querySelectorAll(".cam-live-time").forEach(el => {
      el.textContent = timeStr;
    });
  }
  setInterval(updateHUDs, 200);
  updateHUDs();
}

// Initialize Chart.js for PPE Compliance (Requirement 12)
function initPPECharts() {
  const state = SafeGuardState.getState();

  // 1. PPE Compliance by Day (Line Chart)
  const ctxDay = document.getElementById("chart-ppe-day");
  if (ctxDay && typeof Chart !== "undefined") {
    ppeDayChart = new Chart(ctxDay, {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{
          label: "PPE Compliance (%)",
          data: state.ppeComplianceDetailed.byDay,
          borderColor: "#F97316",
          backgroundColor: "rgba(249, 115, 22, 0.15)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#F97316",
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            min: 85,
            max: 100,
            grid: { color: "rgba(48, 59, 73, 0.5)" },
            ticks: { color: "#9CA3AF" }
          },
          x: {
            grid: { color: "rgba(48, 59, 73, 0.5)" },
            ticks: { color: "#9CA3AF" }
          }
        }
      }
    });
  }

  // 2. PPE Violations by Category (Bar Chart)
  const ctxZone = document.getElementById("chart-ppe-zone");
  if (ctxZone && typeof Chart !== "undefined") {
    const categoryLabels = ["Missing Helmet", "Missing Vest", "Both Missing"];
    const allIncidents = state.incidents || [];
    const noHelmetCount = allIncidents.filter(i => {
      const text = `${i.type || ''} ${i.title || ''} ${i.description || ''}`.toLowerCase();
      return (text.includes("helmet") || text.includes("hardhat")) && !text.includes("vest");
    }).length;
    const noVestCount = allIncidents.filter(i => {
      const text = `${i.type || ''} ${i.title || ''} ${i.description || ''}`.toLowerCase();
      return text.includes("vest") && !(text.includes("helmet") || text.includes("hardhat"));
    }).length;
    const noBothCount = allIncidents.filter(i => {
      const text = `${i.type || ''} ${i.title || ''} ${i.description || ''}`.toLowerCase();
      return (text.includes("helmet") || text.includes("hardhat")) && text.includes("vest");
    }).length;
    const categoryData = [noHelmetCount, noVestCount, noBothCount];

    ppeZoneChart = new Chart(ctxZone, {
      type: "bar",
      data: {
        labels: categoryLabels,
        datasets: [{
          label: "Violations Logged",
          data: categoryData,
          backgroundColor: [
            "#EF4444",
            "#F97316",
            "#991B1B"
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: "#9CA3AF" },
            grid: { color: "rgba(48, 59, 73, 0.5)" }
          },
          x: {
            grid: { display: false },
            ticks: { color: "#9CA3AF" }
          }
        }
      }
    });
  }

  // 3. PPE Violations by Shift (Doughnut Chart)
  const ctxShift = document.getElementById("chart-ppe-shift");
  if (ctxShift && typeof Chart !== "undefined") {
    const shiftData = [0, 0, 0];
    (state.incidents || []).forEach(inc => {
      const shift = (inc.shift || "").toLowerCase();
      if (shift.includes("morning")) shiftData[0]++;
      else if (shift.includes("afternoon")) shiftData[1]++;
      else if (shift.includes("night")) shiftData[2]++;
    });
    // If no incidents exist, show empty or zero slice
    const hasData = shiftData.some(v => v > 0);

    ppeShiftChart = new Chart(ctxShift, {
      type: "doughnut",
      data: {
        labels: ["Morning Shift", "Afternoon Shift", "Night Shift"],
        datasets: [{
          data: hasData ? shiftData : [0, 0, 0],
          backgroundColor: ["#F97316", "#38BDF8", "#303B49"],
          borderWidth: 2,
          borderColor: "#1B2430"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#9CA3AF", boxWidth: 12, padding: 12 }
          }
        },
        cutout: "65%"
      }
    });
  }
}

// Update charts dynamically when state changes
function updatePPECharts() {
  const state = SafeGuardState.getState();
  if (ppeDayChart) {
    ppeDayChart.data.datasets[0].data = state.ppeComplianceDetailed.byDay;
    ppeDayChart.update();
  }
  if (ppeZoneChart) {
    const allIncidents = state.incidents || [];
    const noHelmetCount = allIncidents.filter(i => {
      const text = `${i.type || ''} ${i.title || ''} ${i.description || ''}`.toLowerCase();
      return (text.includes("helmet") || text.includes("hardhat")) && !text.includes("vest");
    }).length;
    const noVestCount = allIncidents.filter(i => {
      const text = `${i.type || ''} ${i.title || ''} ${i.description || ''}`.toLowerCase();
      return text.includes("vest") && !(text.includes("helmet") || text.includes("hardhat"));
    }).length;
    const noBothCount = allIncidents.filter(i => {
      const text = `${i.type || ''} ${i.title || ''} ${i.description || ''}`.toLowerCase();
      return (text.includes("helmet") || text.includes("hardhat")) && text.includes("vest");
    }).length;
    ppeZoneChart.data.datasets[0].data = [noHelmetCount, noVestCount, noBothCount];
    ppeZoneChart.update();
  }
  if (ppeShiftChart) {
    const shiftData = [0, 0, 0];
    (state.incidents || []).forEach(inc => {
      const shift = (inc.shift || "").toLowerCase();
      if (shift.includes("morning")) shiftData[0]++;
      else if (shift.includes("afternoon")) shiftData[1]++;
      else if (shift.includes("night")) shiftData[2]++;
    });
    ppeShiftChart.data.datasets[0].data = shiftData;
    ppeShiftChart.update();
  }
}

// Camera Details Modal
function openCameraModal(camId, camName, location) {
  const modal = document.getElementById("camera-detail-modal");
  const title = document.getElementById("cam-modal-title");
  const feedZone = document.getElementById("cam-modal-zone");

  if (title) title.textContent = `${camId} — ${camName}`;
  if (feedZone) feedZone.textContent = `Location: ${location || 'Facility Work Area'}`;

  SafeGuardApp.openModal("camera-detail-modal");
}

function toggleModalBoxes() {
  const modalBoxes = document.querySelectorAll("#camera-detail-modal .ai-bbox");
  modalBoxes.forEach(box => {
    box.style.display = box.style.display === "none" ? "block" : "none";
  });
  SafeGuardApp.showToast("Vision Overlay", "AI bounding box layer visibility toggled.", "info");
}

function captureCameraSnapshot() {
  SafeGuardApp.showToast("Snapshot Saved", "CCTV frame captured: Snapshot_1080p_YOLOv8.png", "success");
}
