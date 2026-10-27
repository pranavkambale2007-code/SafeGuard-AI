/**
 * SafeGuard AI — Analytics & Predictive Intelligence Controller
 * Manages 8 Chart.js charts, interactive facility safety heatmap, and predictive risk forecast.
 */

let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  initAnalyticsCharts();
  renderHeatmap();
  bindAnalyticsFilters();

  window.addEventListener("safeguard_state_changed", () => {
    updateAnalyticsCharts();
    renderHeatmap();
  });
});

function bindAnalyticsFilters() {
  const dateFilter = document.getElementById("filter-analytics-date");
  const zoneFilter = document.getElementById("filter-analytics-zone");
  const shiftFilter = document.getElementById("filter-analytics-shift");
  const typeFilter = document.getElementById("filter-analytics-type");

  const applyFilters = () => {
    const dateVal = dateFilter ? dateFilter.value : "Last 30 Days";
    const zoneVal = zoneFilter ? zoneFilter.value : "All Facility Zones";
    const shiftVal = shiftFilter ? shiftFilter.value : "All Shifts (24 Hours)";
    const typeVal = typeFilter ? typeFilter.value : "All Incident Types";

    // Update Incident Trends based on Date
    if (charts.incidentTrends) {
      if (dateVal === "This Week") {
        charts.incidentTrends.data.labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        charts.incidentTrends.data.datasets[0].data = [12, 14, 9, 11, 15, 10, 8];
      } else if (dateVal === "Current Quarter") {
        charts.incidentTrends.data.labels = ["Month 1", "Month 2", "Month 3"];
        charts.incidentTrends.data.datasets[0].data = [48, 39, 31];
      } else {
        charts.incidentTrends.data.labels = ["Day 1", "Day 5", "Day 10", "Day 15", "Day 20", "Day 25", "Today"];
        charts.incidentTrends.data.datasets[0].data = [18, 14, 15, 11, 9, 14, 12];
      }
      charts.incidentTrends.update();
    }

    // Update Incidents by Zone highlighting
    if (charts.incidentsByZone) {
      if (zoneVal.includes("Zone B")) {
        charts.incidentsByZone.data.datasets[0].backgroundColor = ["rgba(34,197,94,0.3)", "#F97316", "rgba(239,68,68,0.3)", "rgba(251,191,36,0.3)", "rgba(34,197,94,0.3)"];
      } else if (zoneVal.includes("Zone C")) {
        charts.incidentsByZone.data.datasets[0].backgroundColor = ["rgba(34,197,94,0.3)", "rgba(249,115,22,0.3)", "#EF4444", "rgba(251,191,36,0.3)", "rgba(34,197,94,0.3)"];
      } else {
        charts.incidentsByZone.data.datasets[0].backgroundColor = ["#22C55E", "#F97316", "#EF4444", "#FBBF24", "#22C55E"];
      }
      charts.incidentsByZone.update();
    }

    SafeGuardApp.showToast("Analytics Filtered", `Data focused: ${zoneVal} • ${dateVal}`, "info");
  };

  if (dateFilter) dateFilter.addEventListener("change", applyFilters);
  if (zoneFilter) zoneFilter.addEventListener("change", applyFilters);
  if (shiftFilter) shiftFilter.addEventListener("change", applyFilters);
  if (typeFilter) typeFilter.addEventListener("change", applyFilters);
}

function initAnalyticsCharts() {
  if (typeof Chart === "undefined") return;

  // Global Chart.js styling defaults
  Chart.defaults.color = "#9CA3AF";
  Chart.defaults.font.family = "'Inter', sans-serif";

  // 1. Incident Trends (Line Chart)
  const ctx1 = document.getElementById("chart-incident-trends");
  if (ctx1) {
    charts.incidentTrends = new Chart(ctx1, {
      type: "line",
      data: {
        labels: ["Day 1", "Day 5", "Day 10", "Day 15", "Day 20", "Day 25", "Today"],
        datasets: [{
          label: "Reported Incidents",
          data: [18, 14, 15, 11, 9, 14, 12],
          borderColor: "#EF4444",
          backgroundColor: "rgba(239, 68, 68, 0.12)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: "#EF4444"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(48, 59, 73, 0.5)" } },
          y: { beginAtZero: true, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }

  // 2. PPE Compliance (Line Chart)
  const ctx2 = document.getElementById("chart-ppe-trends");
  if (ctx2) {
    charts.ppeTrends = new Chart(ctx2, {
      type: "line",
      data: {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        datasets: [
          {
            label: "Helmet",
            data: [94.2, 95.1, 95.8, 96.4],
            borderColor: "#22C55E",
            borderWidth: 2,
            tension: 0.3
          },
          {
            label: "Vest",
            data: [91.5, 92.8, 93.6, 94.2],
            borderColor: "#38BDF8",
            borderWidth: 2,
            tension: 0.3
          },
          {
            label: "Overall",
            data: [92.0, 93.4, 94.0, 94.1],
            borderColor: "#F97316",
            borderWidth: 2.5,
            borderDash: [5, 5],
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 10, padding: 10 } }
        },
        scales: {
          x: { grid: { color: "rgba(48, 59, 73, 0.5)" } },
          y: { min: 88, max: 100, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }

  // 3. Incidents by Zone (Bar Chart)
  const ctx3 = document.getElementById("chart-incidents-zone");
  if (ctx3) {
    charts.incidentsByZone = new Chart(ctx3, {
      type: "bar",
      data: {
        labels: ["Assembly", "Machinery", "Chemical", "Warehouse", "Loading"],
        datasets: [{
          label: "Total Incidents",
          data: [2, 6, 4, 3, 2],
          backgroundColor: ["#22C55E", "#F97316", "#EF4444", "#FBBF24", "#22C55E"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }

  // 4. Incident Types (Doughnut Chart)
  const ctx4 = document.getElementById("chart-incident-types");
  if (ctx4) {
    charts.incidentTypes = new Chart(ctx4, {
      type: "doughnut",
      data: {
        labels: ["PPE Violations", "Restricted Zones", "Machine Proximity", "Worker Falls", "Gas / Environmental"],
        datasets: [{
          data: [42, 22, 16, 8, 12],
          backgroundColor: ["#EF4444", "#F97316", "#FBBF24", "#38BDF8", "#303B49"],
          borderWidth: 2,
          borderColor: "#1B2430"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { boxWidth: 10, padding: 12 } }
        },
        cutout: "60%"
      }
    });
  }

  // 5. Risk by Zone (Horizontal Bar Chart)
  const ctx5 = document.getElementById("chart-risk-zone");
  if (ctx5) {
    charts.riskByZone = new Chart(ctx5, {
      type: "bar",
      data: {
        labels: ["Zone C (Chemical)", "Zone B (Machinery)", "Zone D (Warehouse)", "Zone E (Loading)", "Zone A (Assembly)"],
        datasets: [{
          label: "Risk Score (0-100)",
          data: [88, 74, 48, 22, 18],
          backgroundColor: ["#EF4444", "#F97316", "#FBBF24", "#22C55E", "#22C55E"],
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { min: 0, max: 100, grid: { color: "rgba(48, 59, 73, 0.5)" } },
          y: { grid: { display: false } }
        }
      }
    });
  }

  // 6. Shift-wise Incidents (Bar Chart)
  const ctx6 = document.getElementById("chart-shift-incidents");
  if (ctx6) {
    charts.shiftIncidents = new Chart(ctx6, {
      type: "bar",
      data: {
        labels: ["Morning Shift (06-14)", "Afternoon Shift (14-22)", "Night Shift (22-06)"],
        datasets: [{
          label: "Incidents",
          data: [7, 12, 5],
          backgroundColor: ["#F97316", "#38BDF8", "#303B49"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }

  // 7. Alert Response Time (Line Chart)
  const ctx7 = document.getElementById("chart-response-time");
  if (ctx7) {
    charts.responseTime = new Chart(ctx7, {
      type: "line",
      data: {
        labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
        datasets: [{
          label: "Mean Acknowledgment Time (mins)",
          data: [2.8, 1.9, 1.4, 1.6, 2.1, 1.8, 1.5],
          borderColor: "#F97316",
          backgroundColor: "rgba(249, 115, 22, 0.15)",
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(48, 59, 73, 0.5)" } },
          y: { beginAtZero: true, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }

  // 8. Worker Safety Score Distribution (Bar Chart)
  const ctx8 = document.getElementById("chart-worker-scores");
  if (ctx8) {
    const state = SafeGuardState.getState();
    const workers = state.workers || [];
    let under70 = 0, b70to79 = 0, b80to89 = 0, b90to100 = 0;
    workers.forEach(w => {
      const s = w.safetyScore ?? 100;
      if (s < 70) under70++;
      else if (s < 80) b70to79++;
      else if (s < 90) b80to89++;
      else b90to100++;
    });

    charts.workerScores = new Chart(ctx8, {
      type: "bar",
      data: {
        labels: ["< 70 (Critical)", "70 - 79 (Warning)", "80 - 89 (Good)", "90 - 100 (Optimal)"],
        datasets: [{
          label: "Active Workers Count",
          data: [under70, b70to79, b80to89, b90to100],
          backgroundColor: ["#EF4444", "#FBBF24", "#38BDF8", "#22C55E"],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }

  // Risk Forecast Mini Trend Chart (Requirement 23)
  const ctxForecast = document.getElementById("chart-forecast-trend");
  if (ctxForecast) {
    new Chart(ctxForecast, {
      type: "line",
      data: {
        labels: ["T+0h", "T+4h", "T+8h", "T+12h", "T+16h", "T+20h", "T+24h"],
        datasets: [{
          label: "Projected Risk Probability Index",
          data: [68, 72, 79, 82, 77, 73, 70],
          borderColor: "#F97316",
          backgroundColor: "rgba(249, 115, 22, 0.15)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#F97316"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(48, 59, 73, 0.5)" } },
          y: { min: 40, max: 100, grid: { color: "rgba(48, 59, 73, 0.5)" } }
        }
      }
    });
  }
}

// Update charts if data changes
function updateAnalyticsCharts() {
  const state = SafeGuardState.getState();
  if (charts.riskByZone) {
    const zoneA = state.zones.find(z => z.id === "zone-a")?.riskScore || 0;
    charts.riskByZone.data.datasets[0].data[4] = zoneA;
    charts.riskByZone.update();
  }

  if (charts.workerScores) {
    const workers = state.workers || [];
    let under70 = 0, b70to79 = 0, b80to89 = 0, b90to100 = 0;
    workers.forEach(w => {
      const s = w.safetyScore ?? 100;
      if (s < 70) under70++;
      else if (s < 80) b70to79++;
      else if (s < 90) b80to89++;
      else b90to100++;
    });
    charts.workerScores.data.datasets[0].data = [under70, b70to79, b80to89, b90to100];
    charts.workerScores.update();
  }
}

// Requirement 22: Safety Heatmap
function renderHeatmap() {
  const container = document.getElementById("facility-heatmap-cells");
  if (!container) return;

  const state = SafeGuardState.getState();
  const zonesMap = {
    "Assembly": (state.zones || []).find(z => z.id === "zone-a"),
    "Warehouse": (state.zones || []).find(z => z.id === "zone-d"),
    "Machine Shop": (state.zones || []).find(z => z.id === "zone-b"),
    "Chemical Storage": (state.zones || []).find(z => z.id === "zone-c"),
    "Loading Area": (state.zones || []).find(z => z.id === "zone-e"),
    "Scaffolding & Roofing": (state.zones || []).find(z => z.id === "zone-f")
  };

  const zonesData = Object.keys(zonesMap).map(name => {
    const z = zonesMap[name] || { riskScore: 0, activeHazards: 0, recentIncidents: 0, recordedViolations: { total: 0 } };
    const risk = z.riskScore || 0;
    const violations = z.recordedViolations?.total || 0;
    let heat = "heat-low";
    if (risk > 75 || violations >= 4) heat = "heat-critical";
    else if (risk > 50 || violations >= 2) heat = "heat-high";
    else if (risk > 25 || violations >= 1) heat = "heat-medium";

    return {
      name,
      risk,
      violations,
      status: z.inspectionStatus || "Routine Patrol",
      heat
    };
  });

  container.innerHTML = zonesData.map(z => `
    <div class="heatmap-cell ${z.heat}" onmouseenter="showHeatmapTooltip(this, '${z.name}', ${z.risk}, ${z.violations}, '${z.status}')" onmouseleave="hideHeatmapTooltip()" onclick="window.location.href='monitoring.html#site-safety-risk-map'" style="cursor:pointer;" title="Click to view in Site Safety Risk Map">
      <div style="font-size:1.05rem; font-weight:700;">${z.name}</div>
      <div class="mono" style="font-size:1.4rem; margin-top:6px;">${z.risk} / 100</div>
      <div style="font-size:0.75rem; opacity:0.85; margin-top:2px;">Risk Score • ${z.violations} Breaches</div>
    </div>
  `).join("");
}

function showHeatmapTooltip(el, name, risk, violations, status) {
  let tooltip = document.getElementById("heatmap-floating-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "heatmap-floating-tooltip";
    tooltip.style.position = "absolute";
    tooltip.style.background = "#1B2430";
    tooltip.style.border = "1px solid #303B49";
    tooltip.style.color = "#F9FAFB";
    tooltip.style.padding = "10px 14px";
    tooltip.style.borderRadius = "8px";
    tooltip.style.zIndex = "100";
    tooltip.style.boxShadow = "0 8px 24px rgba(0,0,0,0.6)";
    tooltip.style.pointerEvents = "none";
    tooltip.style.fontSize = "0.85rem";
    document.body.appendChild(tooltip);
  }

  tooltip.innerHTML = `
    <strong style="color:var(--accent-primary, #F97316); font-size:0.95rem;">${name}</strong><br/>
    Risk Score: <strong>${risk} / 100</strong><br/>
    Recorded PPE Violations: <strong>${violations}</strong><br/>
    Inspection Status: <strong>${status}</strong><br/>
    <span style="font-size:0.72rem; color:var(--text-secondary);">Click to open Site Safety Risk Map</span>
  `;

  const rect = el.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - 80}px`;
  tooltip.style.top = `${rect.top + window.scrollY - 85}px`;
  tooltip.style.display = "block";
}

function hideHeatmapTooltip() {
  const tooltip = document.getElementById("heatmap-floating-tooltip");
  if (tooltip) tooltip.style.display = "none";
}
