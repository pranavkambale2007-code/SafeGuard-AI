/**
 * SafeGuard AI — Dashboard Controller
 * Handles animated KPI counters, SVG circular gauge animation, and two-sided risk cards.
 */

document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();

  // Listen for real-time state changes
  window.addEventListener("safeguard_state_changed", () => {
    renderDashboard(false); // don't re-run full entry animation
  });
});

function renderDashboard(animateGauge = true) {
  const state = SafeGuardState.getState();

  const activeAlerts = (state.alerts || []).filter(a => a.status === "Active").length;
  const criticalAlerts = (state.alerts || []).filter(a => a.severity === "CRITICAL" && a.status === "Active").length;
  const todayIncidents = (state.incidents || []).length;

  // 1. Render Animated KPI Counters
  animateCounter("kpi-safety-score", state.kpis.safetyScore, "", animateGauge);
  animateCounter("kpi-workers", state.kpis.activeWorkers, "", animateGauge);
  animateCounter("kpi-alerts", activeAlerts, "", animateGauge);
  animateCounter("kpi-critical", criticalAlerts, "", animateGauge);
  animateCounter("kpi-incidents", todayIncidents, "", animateGauge);
  animateCounter("kpi-ppe", state.kpis.ppeCompliance, "%", animateGauge);
  animateCounter("kpi-ai-accuracy", state.aiDetectionMetrics ? state.aiDetectionMetrics.aiConfidence : 99.4, "%", animateGauge);

  const alertEl = document.getElementById("kpi-alerts");
  if (alertEl) alertEl.className = activeAlerts > 0 ? "kpi-value mono text-danger" : "kpi-value mono text-success";
  const critEl = document.getElementById("kpi-critical");
  if (critEl) critEl.className = criticalAlerts > 0 ? "kpi-value mono text-danger" : "kpi-value mono text-success";
  
  const camEl = document.getElementById("kpi-cameras");
  if (camEl) camEl.textContent = `${state.kpis.activeCameras} / ${state.kpis.totalCameras}`;

  // 2. Animate Circular Safety Score Gauge (Requirement 8)
  renderSafetyGauge(state.kpis.safetyScore, animateGauge);

  // 3. Render Two-Sided Safety Intelligence Cards (Requirement 9)
  renderTwoSidedRisk(state);

  // 4. Render Quick Alert Snapshot
  renderDashboardAlerts(state.alerts);

  // 5. Render Live Camera Quick Telemetry
  renderCameraQuickStatus();
}

// Animate numbers smoothly from 0 or current value
function animateCounter(elementId, targetValue, suffix = "", shouldAnimate = true) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!shouldAnimate) {
    el.textContent = `${targetValue}${suffix}`;
    return;
  }

  const startValue = parseFloat(el.textContent) || 0;
  if (startValue === targetValue) {
    el.textContent = `${targetValue}${suffix}`;
    return;
  }

  const isDecimal = (typeof targetValue === "number" && targetValue % 1 !== 0);
  const duration = 400;
  const startTime = performance.now();

  function updateCount(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = isDecimal
      ? +(startValue + (targetValue - startValue) * easeProgress).toFixed(1)
      : Math.floor(startValue + (targetValue - startValue) * easeProgress);

    el.textContent = `${current}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      el.textContent = `${targetValue}${suffix}`;
    }
  }

  requestAnimationFrame(updateCount);
}

// Circular SVG Gauge Animation
function renderSafetyGauge(score, shouldAnimate = true) {
  const circle = document.getElementById("gauge-circle-progress");
  const scoreText = document.getElementById("gauge-score-value");
  const statusText = document.getElementById("gauge-status-badge");

  if (!circle || !scoreText) return;

  // Radius = 90, Circumference = 2 * PI * 90 ≈ 565.48
  const circumference = 565.48;
  circle.style.strokeDasharray = `${circumference}`;

  const targetOffset = circumference - (score / 100) * circumference;

  if (shouldAnimate) {
    circle.style.strokeDashoffset = `${circumference}`;
    setTimeout(() => {
      circle.style.strokeDashoffset = `${targetOffset}`;
    }, 150);
  } else {
    circle.style.strokeDashoffset = `${targetOffset}`;
  }

  // Update Status Color & Label
  let status = "Good";
  let badgeClass = "badge-safe";
  let strokeColor = "var(--cyan)";

  if (score >= 90) {
    status = "Excellent";
    badgeClass = "badge-safe";
    strokeColor = "var(--success)";
  } else if (score >= 75) {
    status = "Good";
    badgeClass = "badge-safe";
    strokeColor = "var(--cyan)";
  } else if (score >= 60) {
    status = "Fair";
    badgeClass = "badge-warning";
    strokeColor = "var(--warning)";
  } else {
    status = "Critical Risk";
    badgeClass = "badge-danger";
    strokeColor = "var(--danger)";
  }

  circle.style.stroke = strokeColor;
  scoreText.textContent = score;

  if (statusText) {
    statusText.className = `badge ${badgeClass}`;
    statusText.textContent = `Status: ${status}`;
  }
}

// Two-Sided Safety Intelligence Cards
function renderTwoSidedRisk(state) {
  const w = (state.twoSidedRisk && state.twoSidedRisk.workerSafety) || { score: 100, ppe: 100, training: 100, zoneCompliance: 100 };

  // Worker card
  const wScore = document.getElementById("two-sided-worker-score");
  if (wScore) wScore.textContent = `${w.score} / 100`;

  const wPpe = document.getElementById("metric-w-ppe");
  if (wPpe) wPpe.textContent = `${w.ppe}%`;
  const wPpeBar = document.getElementById("bar-w-ppe");
  if (wPpeBar) wPpeBar.style.width = `${w.ppe}%`;

  const wTrain = document.getElementById("metric-w-training");
  if (wTrain) wTrain.textContent = `${w.training}%`;
  const wTrainBar = document.getElementById("bar-w-training");
  if (wTrainBar) wTrainBar.style.width = `${w.training}%`;

  const wZone = document.getElementById("metric-w-zone");
  if (wZone) wZone.textContent = `${w.zoneCompliance}%`;
  const wZoneBar = document.getElementById("bar-w-zone");
  if (wZoneBar) wZoneBar.style.width = `${w.zoneCompliance}%`;

  // AI PPE Safety Telemetry card
  const activeAlerts = (state.alerts || []).filter(a => a.status === "Active").length;
  const ppeStatus = document.getElementById("two-sided-ppe-status");
  if (ppeStatus) {
    if (activeAlerts > 0) {
      ppeStatus.textContent = "Infraction Active";
      ppeStatus.className = "mono text-danger";
    } else {
      ppeStatus.textContent = "100% Active";
      ppeStatus.className = "mono text-success";
    }
  }

  const ppeHelmet = document.getElementById("metric-ppe-helmet");
  if (ppeHelmet) ppeHelmet.textContent = `${(state.ppeComplianceDetailed && state.ppeComplianceDetailed.helmet) || 100}%`;

  const ppeVest = document.getElementById("metric-ppe-vest");
  if (ppeVest) ppeVest.textContent = `${(state.ppeComplianceDetailed && state.ppeComplianceDetailed.vest) || 100}%`;

  const ppeConf = document.getElementById("metric-ppe-confidence");
  if (ppeConf) ppeConf.textContent = `${(state.aiDetectionMetrics && state.aiDetectionMetrics.aiConfidence) || 99.4}%`;

  // AI Priority banner
  const aiBanner = document.getElementById("ai-priority-text");
  if (aiBanner) {
    aiBanner.textContent = (state.twoSidedRisk && state.twoSidedRisk.aiPriority) 
      ? state.twoSidedRisk.aiPriority.replace(/zones?/gi, "operations")
      : "All Facility Operations Operating Securely Within Safety Baselines";
  }
}

// Render Dashboard Quick Alerts
function renderDashboardAlerts(alerts) {
  const container = document.getElementById("dashboard-recent-alerts");
  if (!container) return;

  const topAlerts = (alerts || []).slice(0, 5);

  if (topAlerts.length === 0) {
    container.innerHTML = `
      <div style="padding:32px 16px; text-align:center; color:var(--text-secondary); background:var(--bg-secondary); border-radius:var(--radius-md); border:1px solid var(--border-light);">
        <div style="font-size:2rem; margin-bottom:8px;">🛡️</div>
        <strong style="color:var(--text-primary); font-size:0.95rem;">All Systems Nominal</strong>
        <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">No active safety infractions or sensor alerts logged.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = topAlerts.map(a => {
    let badgeClass = "badge-warning";
    let icon = "🟡";
    if (a.severity === "CRITICAL") { badgeClass = "badge-danger"; icon = "🔴"; }
    else if (a.severity === "HIGH") { badgeClass = "badge-high"; icon = "🟠"; }

    const snapshotHtml = a.snapshot 
      ? `<img src="${a.snapshot}" class="alert-snapshot-thumb" alt="Live Camera Snapshot" title="Click to view full violation snapshot" onclick="openSnapshotModal('${a.snapshot}', '${a.title}')">`
      : '';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-secondary); border-radius:var(--radius-md); border:1px solid var(--border-light); margin-bottom:10px; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:1.1rem;">${icon}</span>
          <div>
            <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">${a.title}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
              ${a.timeAgo}${a.worker ? ` • <span style="color:var(--cyan); font-weight:600;">👷 ${a.worker}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          ${snapshotHtml}
          <a href="alerts.html" class="btn btn-outline btn-sm">Inspect</a>
        </div>
      </div>
    `;
  }).join("");
}

// Render Live Camera Status on Dashboard
function renderCameraQuickStatus() {
  const modeEl = document.getElementById("dash-cam-active-mode");
  const helmetEl = document.getElementById("dash-cam-helmet-badge");
  const vestEl = document.getElementById("dash-cam-vest-badge");

  if (window.LiveCameraDetector) {
    const det = LiveCameraDetector.currentDetection;
    const mode = LiveCameraDetector.currentMode === "webcam"
      ? "🎥 Live Webcam"
      : (LiveCameraDetector.currentMode === "sample" ? "🧪 Test Scenario" : "📁 Media Upload");
    if (modeEl) modeEl.textContent = mode;

    if (helmetEl) {
      if (det.hasHelmet) {
        helmetEl.className = "badge badge-safe";
        helmetEl.innerHTML = `✓ DETECTED: ${det.helmetType || "Hardhat"} (${det.helmetConf}%)`;
      } else {
        helmetEl.className = "badge badge-danger ppe-pulse-alert";
        helmetEl.innerHTML = det.isBikeHelmet
          ? `❌ NOT DETECTED (Bike Helmet Unapproved)`
          : `❌ NOT DETECTED: Missing Hardhat (${det.helmetConf}%)`;
      }
    }

    if (vestEl) {
      if (det.hasVest) {
        vestEl.className = "badge badge-safe";
        vestEl.innerHTML = `✓ DETECTED: ${det.vestType || "Vest"} (${det.vestConf}%)`;
      } else {
        vestEl.className = "badge badge-danger ppe-pulse-alert";
        vestEl.innerHTML = `❌ NOT DETECTED: Missing Vest (${det.vestConf}%)`;
      }
    }
  }
}

// Live Camera Modal Handlers on Dashboard
function openDashboardCameraModal() {
  SafeGuardApp.openModal('dashboard-camera-modal');
  if (window.LiveCameraDetector) {
    LiveCameraDetector.init({
      videoId: "live-camera-video",
      canvasId: "live-camera-canvas"
    });
  }
}

function closeDashboardCameraModal() {
  if (window.LiveCameraDetector) {
    LiveCameraDetector.stopCurrentStream();
  }
  SafeGuardApp.closeModal('dashboard-camera-modal');
}

function openSnapshotModal(src, title) {
  let modal = document.getElementById("snapshot-preview-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "snapshot-preview-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-box" style="max-width:700px;">
        <div class="modal-header">
          <h3 class="modal-title" id="snapshot-modal-title">Violation Snapshot</h3>
          <button class="modal-close-btn" onclick="SafeGuardApp.closeModal('snapshot-preview-modal')">&times;</button>
        </div>
        <div class="modal-body" style="text-align:center;">
          <img id="snapshot-modal-img" class="modal-snapshot-preview" src="" alt="Snapshot">
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById("snapshot-modal-title").textContent = title || "Live Camera Violation Snapshot";
  document.getElementById("snapshot-modal-img").src = src;
  SafeGuardApp.openModal("snapshot-preview-modal");
}

