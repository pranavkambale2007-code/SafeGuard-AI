/**
 * SafeGuard AI — Incident Management Controller
 * Handles incident logging, filtering, table rendering, and the incident details modal.
 */

let incidentFilterStatus = "ALL";
let incidentFilterSeverity = "ALL";

document.addEventListener("DOMContentLoaded", () => {
  renderIncidentsTable();
  bindIncidentFilterEvents();

  window.addEventListener("safeguard_state_changed", () => {
    renderIncidentsTable();
  });
});

function bindIncidentFilterEvents() {
  const searchInput = document.getElementById("incident-search-input");
  const statusFilter = document.getElementById("incident-status-filter");
  const severityFilter = document.getElementById("incident-severity-filter");

  if (searchInput) searchInput.addEventListener("input", applyIncidentFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyIncidentFilters);
  if (severityFilter) severityFilter.addEventListener("change", applyIncidentFilters);
}

function applyIncidentFilters() {
  const state = SafeGuardState.getState();
  const search = (document.getElementById("incident-search-input")?.value || "").toLowerCase().trim();
  const status = document.getElementById("incident-status-filter")?.value || "ALL";
  const severity = document.getElementById("incident-severity-filter")?.value || "ALL";

  let filtered = state.incidents.filter(inc => {
    const loc = inc.location || inc.zone || "";
    const matchesSearch = inc.id.toLowerCase().includes(search) || 
                          inc.type.toLowerCase().includes(search) || 
                          loc.toLowerCase().includes(search) ||
                          inc.description.toLowerCase().includes(search);
    const matchesStatus = status === "ALL" || inc.status.toUpperCase() === status.toUpperCase();
    const matchesSeverity = severity === "ALL" || inc.severity.toUpperCase() === severity.toUpperCase();
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  renderIncidentTableRows(filtered);
}

function renderIncidentsTable() {
  const state = SafeGuardState.getState();

  // Metrics
  const total = state.incidents.length;
  const openCount = state.incidents.filter(i => i.status === "Open" || i.status === "Under Investigation").length;
  const resolvedCount = state.incidents.filter(i => i.status === "Resolved").length;
  const nearMisses = state.incidents.filter(i => i.type && i.type.toLowerCase().includes("near miss")).length;

  const elTotal = document.getElementById("inc-stat-total");
  const elOpen = document.getElementById("inc-stat-open");
  const elResolved = document.getElementById("inc-stat-resolved");
  const elNear = document.getElementById("inc-stat-nearmisses");

  if (elTotal) elTotal.textContent = total;
  if (elOpen) elOpen.textContent = openCount;
  if (elResolved) elResolved.textContent = resolvedCount;
  if (elNear) elNear.textContent = nearMisses;

  applyIncidentFilters();
}

function renderIncidentTableRows(incidents) {
  const tbody = document.getElementById("incidents-table-body");
  if (!tbody) return;

  if (incidents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:36px; color:var(--text-secondary);"><div style="font-size:2rem; margin-bottom:6px;">📋</div><strong>No Incident Records Found</strong><br/><span style="font-size:0.8rem;">Facility incident register is clear. No occupational incidents recorded.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = incidents.map(inc => {
    let sevBadge = "badge-warning";
    if (inc.severity === "Critical") sevBadge = "badge-danger";
    if (inc.severity === "High") sevBadge = "badge-high";
    if (inc.severity === "Low") sevBadge = "badge-safe";

    let statBadge = "badge-danger";
    if (inc.status === "Resolved") statBadge = "badge-safe";
    if (inc.status === "Under Investigation") statBadge = "badge-warning";

    return `
      <tr style="cursor:pointer;" onclick="openIncidentDetails('${inc.id}')">
        <td class="mono" style="font-weight:700; color:var(--cyan);">${inc.id}</td>
        <td style="font-weight:600;">
          ${inc.type}
          ${inc.worker ? `<div style="font-size:0.75rem; color:var(--cyan); font-weight:500; margin-top:2px;">👷 ${inc.worker}</div>` : ''}
        </td>
        <td><span class="badge badge-blue">${inc.location || inc.zone || 'Plant Floor'}</span></td>
        <td><span class="badge ${sevBadge}">${inc.severity}</span></td>
        <td style="color:var(--text-secondary); font-size:0.85rem;">${inc.time}</td>
        <td><span class="badge ${statBadge}">${inc.status}</span></td>
        <td style="font-size:0.85rem;">${inc.officer}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openIncidentDetails('${inc.id}')">Details</button>
        </td>
      </tr>
    `;
  }).join("");
}

// Requirement 20: Click an incident to open modal
function openIncidentDetails(incidentId) {
  const state = SafeGuardState.getState();
  const inc = state.incidents.find(i => i.id === incidentId);
  if (!inc) return;

  document.getElementById("modal-inc-id").textContent = inc.id;
  document.getElementById("modal-inc-type").textContent = inc.type;
  document.getElementById("modal-inc-zone").textContent = inc.location || inc.zone || "Plant Floor";
  document.getElementById("modal-inc-severity").textContent = inc.severity;
  document.getElementById("modal-inc-time").textContent = inc.time;
  document.getElementById("modal-inc-status").textContent = inc.status;
  document.getElementById("modal-inc-officer").textContent = inc.officer;
  document.getElementById("modal-inc-desc").textContent = inc.description;
  document.getElementById("modal-inc-evidence").textContent = inc.evidence || "CCTV Camera Recorded Clip";
  document.getElementById("modal-inc-action").textContent = inc.actionTaken || "Investigation in progress.";

  const resolveBtn = document.getElementById("btn-resolve-incident");
  if (resolveBtn) {
    if (inc.status === "Resolved") {
      resolveBtn.style.display = "none";
    } else {
      resolveBtn.style.display = "inline-flex";
      resolveBtn.onclick = () => resolveIncident(inc.id);
    }
  }

  SafeGuardApp.openModal("incident-detail-modal");
}

function resolveIncident(incidentId) {
  SafeGuardState.update(state => {
    const inc = state.incidents.find(i => i.id === incidentId);
    if (inc) {
      inc.status = "Resolved";
      inc.actionTaken = "Remediated by Safety Officer; protocol re-verified.";
      state.auditLogs.unshift({
        time: "Just now",
        action: `Incident ${incidentId} marked as Resolved`,
        user: state.user.name
      });
    }
    return state;
  });

  SafeGuardApp.closeModal("incident-detail-modal");
  SafeGuardApp.showToast("Incident Resolved", `${incidentId} has been marked as Resolved in official logs.`, "success");
}

// Log New Manual Incident
function submitNewIncident(event) {
  event.preventDefault();
  const type = document.getElementById("new-inc-type").value;
  const zone = document.getElementById("new-inc-zone").value;
  const severity = document.getElementById("new-inc-severity").value;
  const desc = document.getElementById("new-inc-desc").value;

  const newId = `INC-2026-00${Math.floor(90 + Math.random() * 9)}`;
  const newInc = {
    id: newId,
    type: type,
    location: zone,
    zone: zone,
    severity: severity,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: "Open",
    officer: "Safety Officer",
    description: desc,
    evidence: "Manual Floor Report",
    actionTaken: "Under initial inspection."
  };

  SafeGuardState.update(state => {
    state.incidents.unshift(newInc);
    state.kpis.todayIncidents += 1;
    return state;
  });

  event.target.reset();
  SafeGuardApp.closeModal("new-incident-modal");
  SafeGuardApp.showToast("Incident Logged", `${newId} has been registered successfully.`, "success");
}
