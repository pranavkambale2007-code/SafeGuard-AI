/**
 * SafeGuard AI — Real-Time Alert Center Controller
 * Manages active alerts feed, severity filtering, acknowledge/escalate actions, and live simulation toggling.
 */

let currentAlertFilter = "ALL";

document.addEventListener("DOMContentLoaded", () => {
  renderAlertsList();
  bindAlertFilterEvents();

  window.addEventListener("safeguard_state_changed", () => {
    renderAlertsList();
  });
});

function bindAlertFilterEvents() {
  document.querySelectorAll(".alert-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".alert-filter-btn").forEach(b => b.classList.remove("active", "btn-cyan"));
      document.querySelectorAll(".alert-filter-btn").forEach(b => b.classList.add("btn-outline"));
      btn.classList.add("btn-cyan");
      btn.classList.remove("btn-outline");
      currentAlertFilter = btn.getAttribute("data-filter");
      renderAlertsList();
    });
  });
}

function renderAlertsList() {
  const state = SafeGuardState.getState();
  const container = document.getElementById("alerts-container");
  if (!container) return;

  const alertsList = state.alerts || [];

  // Update counters
  const activeCount = alertsList.filter(a => a.status === "Active").length;
  const criticalCount = alertsList.filter(a => a.severity === "CRITICAL" && a.status === "Active").length;
  const totalToday = alertsList.length;

  const countActiveEl = document.getElementById("alerts-stat-active");
  if (countActiveEl) {
    countActiveEl.textContent = activeCount;
    countActiveEl.className = activeCount > 0 ? "mono text-danger" : "mono text-success";
  }

  const countCritEl = document.getElementById("alerts-stat-critical");
  if (countCritEl) {
    countCritEl.textContent = criticalCount;
    countCritEl.className = criticalCount > 0 ? "mono text-danger" : "mono text-success";
  }

  const countTodayEl = document.getElementById("alerts-stat-today");
  if (countTodayEl) countTodayEl.textContent = totalToday;

  // Filter alerts
  let filtered = alertsList;
  if (currentAlertFilter === "CRITICAL") {
    filtered = alertsList.filter(a => a.severity === "CRITICAL");
  } else if (currentAlertFilter === "HIGH") {
    filtered = alertsList.filter(a => a.severity === "HIGH");
  } else if (currentAlertFilter === "WARNING") {
    filtered = alertsList.filter(a => a.severity === "WARNING");
  } else if (currentAlertFilter === "ACKNOWLEDGED") {
    filtered = alertsList.filter(a => a.status === "Acknowledged");
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:50px 20px; color:var(--text-secondary); border:1px solid var(--border-light);">
        <div style="font-size:3rem; margin-bottom:12px;">🛡️</div>
        <h3 style="color:var(--text-primary); font-size:1.2rem; margin-bottom:6px;">No Active Safety Alerts</h3>
        <p style="font-size:0.9rem; max-width:420px; margin:0 auto;">
          All facility operations, IoT environmental sensors, and live camera feeds are operating within safe compliance thresholds.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(alert => {
    let icon = "🟡";
    let badgeClass = "badge-warning";
    let borderClass = "warning-alert";

    if (alert.severity === "CRITICAL") {
      icon = "🔴";
      badgeClass = "badge-danger";
      borderClass = "critical-alert";
    } else if (alert.severity === "HIGH") {
      icon = "🟠";
      badgeClass = "badge-high";
      borderClass = "high-alert";
    }

    const isAcknowledged = alert.status === "Acknowledged";
    const snapshotHtml = alert.snapshot
      ? `<div style="margin-top:10px; display:flex; align-items:center; gap:8px;">
           <img src="${alert.snapshot}" class="alert-snapshot-thumb" alt="Live Camera Snapshot" title="Click to view full violation snapshot" onclick="openSnapshotModal('${alert.snapshot}', '${alert.title}')">
           <span style="font-size:0.75rem; color:var(--cyan);">📷 Frame Snapshot Captured</span>
         </div>`
      : '';

    return `
      <div class="alert-card ${borderClass}" style="${isAcknowledged ? 'opacity:0.65;' : ''}">
        <div class="alert-content-left">
          <div style="font-size:1.8rem;">${icon}</div>
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
              <span class="badge ${badgeClass}">${alert.severity}</span>
              ${alert.worker ? `<span class="badge badge-cyan" style="font-weight:700;">👷 ${alert.worker}</span>` : ''}
              <span style="font-size:0.8rem; color:var(--text-secondary);">${alert.timeAgo}</span>
              ${isAcknowledged ? '<span class="badge badge-safe">Acknowledged</span>' : ''}
              ${alert.isLiveCamera ? '<span class="badge badge-danger">● LIVE CAMERA</span>' : ''}
            </div>
            <h3 style="font-size:1.1rem; margin-bottom:4px;">${alert.title}</h3>
            <p style="color:var(--text-secondary); font-size:0.88rem; max-width:650px;">${alert.details}</p>
            ${snapshotHtml}
          </div>
        </div>
        <div class="alert-actions">
          ${!isAcknowledged ? `
            <button class="btn btn-outline btn-sm" onclick="acknowledgeAlert('${alert.id}')">Acknowledge</button>
            <button class="btn btn-primary btn-sm" onclick="escalateAlert('${alert.id}')">Escalate</button>
          ` : `
            <span style="font-size:0.8rem; color:var(--success); font-weight:600;">✓ Handled</span>
          `}
          <a href="monitoring.html" class="btn btn-outline btn-sm">View Stream</a>
        </div>
      </div>
    `;
  }).join("");
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

function acknowledgeAlert(alertId) {
  SafeGuardState.update(state => {
    const target = state.alerts.find(a => a.id === alertId);
    if (target) {
      target.status = "Acknowledged";
      state.kpis.activeAlerts = Math.max(0, state.kpis.activeAlerts - 1);
      if (target.severity === "CRITICAL") {
        state.kpis.criticalAlerts = Math.max(0, state.kpis.criticalAlerts - 1);
      }
      state.auditLogs.unshift({
        time: "Just now",
        action: `Alert ${alertId} acknowledged by Safety Officer`,
        user: state.user.name
      });
    }
    return state;
  });
  SafeGuardApp.showToast("Alert Acknowledged", `Alert ${alertId} has been acknowledged and marked as handled.`, "success");
}

function escalateAlert(alertId) {
  SafeGuardState.update(state => {
    const target = state.alerts.find(a => a.id === alertId);
    if (target) {
      if (!target.title.startsWith("[ESCALATED]")) {
        target.title = `[ESCALATED] ${target.title}`;
      }
      target.severity = "CRITICAL";
      target.severityClass = "critical-alert";
    }
    state.auditLogs.unshift({
      time: "Just now",
      action: `URGENT: Alert ${alertId} escalated to Plant Safety Director & SMS dispatched`,
      user: state.user.name
    });
    return state;
  });
  SafeGuardApp.playAudioChime(true);
  SafeGuardApp.showToast("🚨 Alert Escalated", `Alert ${alertId} escalated to Plant Emergency Response Team. Priority SMS dispatched.`, "danger");
}
