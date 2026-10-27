/**
 * SafeGuard AI — IoT Sensors & Environmental Telemetry Controller
 * Manages live fluctuating sensor readings, threshold breach alerts, and multi-timeline Chart.js graph.
 */

let envChart = null;
let currentTimeline = "1h";
let sensorInterval = null;

// Baseline timeline datasets
const timelineData = {
  "1h": {
    labels: ["10:00", "10:10", "10:20", "10:30", "10:40", "10:50", "11:00"],
    gas: [610, 625, 638, 642, 635, 648, 640],
    temp: [30.8, 31.0, 31.2, 31.5, 31.3, 31.4, 31.4],
    smoke: [10, 11, 12, 11, 13, 12, 12],
    humidity: [64, 63, 62, 62, 61, 62, 62]
  },
  "6h": {
    labels: ["05:00", "06:00", "07:00", "08:00", "09:00", "10:00", "11:00"],
    gas: [580, 595, 620, 660, 650, 635, 640],
    temp: [28.2, 29.0, 30.1, 31.8, 32.2, 31.7, 31.4],
    smoke: [8, 9, 11, 14, 13, 12, 12],
    humidity: [68, 66, 64, 61, 60, 61, 62]
  },
  "24h": {
    labels: ["12:00", "16:00", "20:00", "00:00", "04:00", "08:00", "11:00"],
    gas: [550, 610, 630, 590, 570, 620, 640],
    temp: [32.5, 34.0, 30.5, 27.2, 26.8, 29.5, 31.4],
    smoke: [9, 12, 14, 10, 8, 11, 12],
    humidity: [58, 55, 62, 70, 72, 65, 62]
  },
  "7d": {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    gas: [590, 610, 625, 650, 640, 580, 640],
    temp: [30.2, 31.5, 32.1, 31.8, 32.4, 29.8, 31.4],
    smoke: [11, 13, 12, 15, 14, 9, 12],
    humidity: [63, 61, 60, 64, 62, 67, 62]
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initEnvChart();
  renderSensorsUI();
  startSensorFluctuations();
});

// Initialize Chart.js Environmental Graph (Requirement 15)
function initEnvChart() {
  const ctx = document.getElementById("env-telemetry-chart");
  if (!ctx || typeof Chart === "undefined") return;

  const data = timelineData[currentTimeline];

  envChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Gas (ppm)",
          data: data.gas,
          borderColor: "#38BDF8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "y"
        },
        {
          label: "Temperature (°C)",
          data: data.temp,
          borderColor: "#F97316",
          backgroundColor: "transparent",
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "y1"
        },
        {
          label: "Smoke (ppm)",
          data: data.smoke,
          borderColor: "#FBBF24",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderDash: [4, 4],
          tension: 0.3,
          yAxisID: "y"
        },
        {
          label: "Humidity (%)",
          data: data.humidity,
          borderColor: "#22C55E",
          backgroundColor: "transparent",
          borderWidth: 1.5,
          tension: 0.3,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: { color: "#9CA3AF", boxWidth: 12, padding: 14 }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(48, 59, 73, 0.5)" },
          ticks: { color: "#9CA3AF" }
        },
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: { display: true, text: "Gas & Smoke (ppm)", color: "#9CA3AF" },
          grid: { color: "rgba(48, 59, 73, 0.5)" },
          ticks: { color: "#9CA3AF" }
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: { display: true, text: "Temp (°C) / Humidity (%)", color: "#9CA3AF" },
          grid: { drawOnChartArea: false },
          ticks: { color: "#9CA3AF" }
        }
      }
    }
  });
}

// Switch Timeline Buttons (1h, 6h, 24h, 7d)
function switchTimeline(timeline) {
  currentTimeline = timeline;
  document.querySelectorAll(".btn-timeline").forEach(b => {
    b.classList.toggle("btn-primary", b.getAttribute("data-time") === timeline);
    b.classList.toggle("btn-outline", b.getAttribute("data-time") !== timeline);
  });

  if (envChart && timelineData[timeline]) {
    const data = timelineData[timeline];
    envChart.data.labels = data.labels;
    envChart.data.datasets[0].data = data.gas;
    envChart.data.datasets[1].data = data.temp;
    envChart.data.datasets[2].data = data.smoke;
    envChart.data.datasets[3].data = data.humidity;
    envChart.update();
  }
}

// Requirement 14: Animated Sensor Values (Fluctuate slightly every 3s)
function startSensorFluctuations() {
  if (sensorInterval) clearInterval(sensorInterval);

  sensorInterval = setInterval(() => {
    const state = SafeGuardState.getState();
    if (state.simulationPaused) return;

    // Small realistic jitter
    const deltaGas = Math.floor((Math.random() - 0.48) * 6);
    const deltaTemp = +( (Math.random() - 0.48) * 0.3 ).toFixed(1);
    const deltaSmoke = Math.floor((Math.random() - 0.48) * 2);
    const deltaHum = Math.floor((Math.random() - 0.48) * 2);

    let newGas = Math.max(500, state.sensors.gas.value + deltaGas);
    let newTemp = +(Math.max(24.0, state.sensors.temperature.value + deltaTemp)).toFixed(1);
    let newSmoke = Math.max(5, state.sensors.smoke.value + deltaSmoke);
    let newHum = Math.max(40, state.sensors.humidity.value + deltaHum);

    // Check thresholds
    let hasAnomaly = false;
    let anomalyMessage = "";

    if (newGas > state.sensors.gas.threshold) {
      hasAnomaly = true;
      anomalyMessage = `⚠️ Gas concentration (${newGas} ppm) exceeded threshold (${state.sensors.gas.threshold} ppm)`;
    } else if (newTemp > state.sensors.temperature.threshold) {
      hasAnomaly = true;
      anomalyMessage = `⚠️ Ambient Temperature (${newTemp}°C) exceeded threshold (${state.sensors.temperature.threshold}°C)`;
    } else if (newSmoke > state.sensors.smoke.threshold) {
      hasAnomaly = true;
      anomalyMessage = `⚠️ Smoke particle density (${newSmoke} ppm) exceeded threshold (${state.sensors.smoke.threshold} ppm)`;
    }

    // Update state
    SafeGuardState.update(s => {
      s.sensors.gas.value = newGas;
      s.sensors.temperature.value = newTemp;
      s.sensors.smoke.value = newSmoke;
      s.sensors.humidity.value = newHum;
      return s;
    });

    renderSensorsUI(hasAnomaly, anomalyMessage);

  }, 3500);
}

function renderSensorsUI(hasAnomaly = false, anomalyMessage = "") {
  const state = SafeGuardState.getState();
  const s = state.sensors;

  const gasEl = document.getElementById("sensor-val-gas");
  const tempEl = document.getElementById("sensor-val-temp");
  const smokeEl = document.getElementById("sensor-val-smoke");
  const humEl = document.getElementById("sensor-val-humidity");
  const motionEl = document.getElementById("sensor-val-motion");

  if (gasEl) gasEl.textContent = `${s.gas.value} ppm`;
  if (tempEl) tempEl.textContent = `${s.temperature.value} °C`;
  if (smokeEl) smokeEl.textContent = `${s.smoke.value} ppm`;
  if (humEl) humEl.textContent = `${s.humidity.value} %`;
  if (motionEl) motionEl.textContent = s.motion.status;

  // Anomaly Banner (Requirement 15)
  const banner = document.getElementById("sensor-anomaly-banner");
  const bannerText = document.getElementById("anomaly-banner-text");

  if (banner && bannerText) {
    if (hasAnomaly) {
      banner.style.display = "flex";
      bannerText.textContent = anomalyMessage;
    } else {
      banner.style.display = "none";
    }
  }
}

// Manual Test Trigger: Simulate Gas Spike
function simulateGasSpike() {
  SafeGuardState.update(s => {
    s.sensors.gas.value = 845;
    s.alerts.unshift({
      id: `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
      severity: "CRITICAL",
      severityClass: "critical-alert",
      title: "Gas concentration exceeded threshold (845 ppm)",
      zone: "Zone C",
      zoneCode: "zone-c",
      timeAgo: "Just now",
      timestamp: new Date().toISOString(),
      details: "Chemical mixing vat volatile organic compound sensor read 845 ppm. Exceeds 800 ppm safety limit.",
      status: "Active"
    });
    s.kpis.activeAlerts += 1;
    s.kpis.criticalAlerts += 1;
    return s;
  });

  if (envChart && envChart.data && envChart.data.datasets[0]) {
    envChart.data.labels.push(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    envChart.data.datasets[0].data.push(845);
    envChart.data.datasets[1].data.push(34.2);
    envChart.data.datasets[2].data.push(22);
    envChart.data.datasets[3].data.push(65);
    envChart.update();
  }

  renderSensorsUI(true, "⚠️ Environmental Anomaly Detected: Gas concentration spiked to 845 ppm in Zone C!");
  SafeGuardApp.playAudioChime(true);
  SafeGuardApp.showToast("Sensor Alert Triggered", "Gas concentration breached 800 ppm threshold. Zone C alert generated.", "danger");
}
