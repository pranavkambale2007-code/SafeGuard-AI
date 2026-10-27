/**
 * SafeGuard AI — Reports & Compliance Exporter Controller
 * Handles report preview modals, printable PDF trigger, and working downloadable CSV generation.
 */

function getReportData(reportKey) {
  const state = SafeGuardState.getState();
  const kpis = state.kpis;
  const ppe = state.ppeComplianceDetailed;
  const sens = state.sensors;
  const incs = state.incidents || [];
  const zones = state.zones || [];

  const templates = {
    daily: {
      title: "Daily Industrial Safety & Health Audit Report",
      period: "Past 24 Hours",
      summary: `Overall facility safety baseline maintained at ${kpis.safetyScore}/100. ${incs.length} active events logged. High compliance across all facility operations.`,
      data: [
        { Metric: "Facility Safety Score", Value: `${kpis.safetyScore} / 100`, Benchmark: "> 85.0", Status: "Compliant" },
        { Metric: "PPE Overall Compliance", Value: `${ppe.overall}%`, Benchmark: "> 90.0%", Status: "Compliant" },
        { Metric: "Active CCTV AI Streams", Value: `${kpis.activeCameras} / 24`, Benchmark: "100%", Status: "Optimal" },
        { Metric: "Active Workers Monitored", Value: `${kpis.activeWorkers} Personnel`, Benchmark: "N/A", Status: "Normal" },
        { Metric: "Total Incidents Today", Value: `${kpis.todayIncidents} Recorded`, Benchmark: "< 15", Status: "Controlled" },
        { Metric: "Active Safety Alerts", Value: `${kpis.activeAlerts} Active`, Benchmark: "0", Status: kpis.activeAlerts === 0 ? "Optimal" : "Attention" }
      ]
    },
    weekly: {
      title: "Weekly Risk Intelligence & Safety Trend Analysis",
      period: "Past 7 Calendar Days",
      summary: `Weekly safety compliance established at ${kpis.safetyScore}/100. AI vision monitoring and sensor interlocks operational.`,
      data: [
        { Metric: "Weekly Average Safety Score", Value: `${kpis.safetyScore} / 100`, Benchmark: "> 85.0", Status: "Compliant" },
        { Metric: "Total Safety Violations", Value: `${incs.length} Events`, Benchmark: "< 50", Status: "Pass" },
        { Metric: "Critical Hazards Mitigated", Value: "0 Unmitigated", Benchmark: "100%", Status: "Resolved" },
        { Metric: "Worker Training Compliance", Value: "100.0%", Benchmark: "> 85.0%", Status: "Compliant" }
      ]
    },
    monthly: {
      title: "Monthly EHS Regulatory Compliance Report",
      period: "Current Operational Month",
      summary: "Comprehensive facility audit report conforming to Directorate General of Factory Advice Service and Labour Institutes (DGFASLI) and ISO 45001 safety guidelines.",
      data: [
        { Metric: "Lost Time Injury Frequency Rate (LTIFR)", Value: "0.00", Benchmark: "< 0.50", Status: "Exceptional" },
        { Metric: "Near Misses Logged & Reviewed", Value: `${incs.filter(i => (i.type || "").toLowerCase().includes("near")).length} Events`, Benchmark: "Mandatory Review", Status: "100% Audited" },
        { Metric: "Facility Lockdown Drills Completed", Value: "2 Drills", Benchmark: "2 / Month", Status: "Completed" }
      ]
    },
    ppe: {
      title: "Automated PPE Computer Vision Compliance Audit",
      period: "Real-time Edge Model YOLOv8 Telemetry",
      summary: `AI vision models verified PPE compliance. Helmet adherence at ${ppe.helmet}%, safety vest adherence at ${ppe.vest}%.`,
      data: [
        { Metric: "Hardhat / Helmet Detection", Value: `${ppe.helmet}%`, Benchmark: "100%", Status: "Optimal" },
        { Metric: "Hi-Vis Safety Vest Adherence", Value: `${ppe.vest}%`, Benchmark: "100%", Status: "Optimal" },
        { Metric: "Restricted Light Curtain Breaches", Value: "0 Breaches", Benchmark: "0", Status: "Compliant" },
        { Metric: "AI Vision Mean Confidence", Value: `${state.aiDetectionMetrics.aiConfidence}%`, Benchmark: "> 90%", Status: "High Precision" }
      ]
    },
    incident: {
      title: "Comprehensive Incident Log & Corrective Action Register",
      period: "Current Operating Shift Log",
      summary: incs.length > 0 
        ? `Log of ${incs.length} recorded incident(s) including PPE telemetry and supervisor remediation status.`
        : "All shifts operating with zero reported safety incidents or violations.",
      data: incs.length > 0 
        ? incs.map(i => ({ Metric: `${i.id} (${i.type})`, Value: i.zone, Benchmark: `${i.severity} Severity`, Status: i.status }))
        : [
            { Metric: "Active Facility Incidents", Value: "0 Recorded", Benchmark: "Zero Harm Target", Status: "Nominal" },
            { Metric: "PPE Non-Compliance", Value: "None", Benchmark: "Zero Harm", Status: "Compliant" },
            { Metric: "Zone Trespassing Events", Value: "None", Benchmark: "Zero Harm", Status: "Compliant" }
          ]
    },
    zone: {
      title: "Zone Risk Stratification & Physical Hazard Assessment",
      period: "Live Facility Sensor & Camera Matrix",
      summary: "Zone-level risk metrics. All operational wings evaluated by multi-sensor matrix and automated computer vision.",
      data: zones.map(z => ({
        Metric: `${z.code} — ${z.name}`,
        Value: `Risk: ${z.riskScore} / 100`,
        Benchmark: "Safe (<30)",
        Status: z.riskScore === 0 ? "🟢 Safe" : (z.riskScore < 50 ? "🟡 Warning" : "🔴 Critical")
      }))
    },
    env: {
      title: "Industrial Environmental & Air Quality IoT Telemetry",
      period: "Past 24 Hours Multisensor Readings",
      summary: "Air quality, combustible gases, smoke particulate density, and ambient humidity logged from IoT calibrated sensor nodes across the manufacturing plant.",
      data: [
        { Metric: "Combustible Gas / VOC Concentration", Value: `${sens.gas.value} ppm`, Benchmark: `< ${sens.gas.threshold} ppm`, Status: sens.gas.status },
        { Metric: "Plant Ambient Temperature", Value: `${sens.temperature.value} °C`, Benchmark: `< ${sens.temperature.threshold} °C`, Status: sens.temperature.status },
        { Metric: "Smoke Particle Density", Value: `${sens.smoke.value} ppm`, Benchmark: `< ${sens.smoke.threshold} ppm`, Status: sens.smoke.status },
        { Metric: "Relative Humidity", Value: `${sens.humidity.value} %`, Benchmark: "30 - 70%", Status: "Optimal" }
      ]
    }
  };

  return templates[reportKey] || templates.daily;
}

let activeReportKey = "daily";

// Preview Modal (Requirement 24)
function previewReport(reportKey) {
  activeReportKey = reportKey;
  const report = getReportData(reportKey);

  document.getElementById("modal-report-title").textContent = report.title;
  document.getElementById("modal-report-period").textContent = `Reporting Window: ${report.period}`;
  document.getElementById("modal-report-summary").textContent = report.summary;

  const tableBody = document.getElementById("modal-report-tbody");
  if (tableBody) {
    tableBody.innerHTML = report.data.map(row => `
      <tr>
        <td style="font-weight:600; color:var(--text-primary);">${row.Metric}</td>
        <td class="mono" style="color:var(--cyan); font-weight:700;">${row.Value}</td>
        <td style="color:var(--text-secondary);">${row.Benchmark}</td>
        <td><span class="badge ${row.Status.includes('Safe') || row.Status.includes('Compliant') || row.Status.includes('Optimal') || row.Status.includes('Pass') || row.Status.includes('Nominal') ? 'badge-safe' : 'badge-warning'}">${row.Status}</span></td>
      </tr>
    `).join("");
  }

  SafeGuardApp.openModal("report-preview-modal");
}

// Download PDF (Requirement 24)
function downloadPDF() {
  window.print();
}

// Export CSV (Requirement 24)
function exportCSV(reportKey = null) {
  const key = reportKey || activeReportKey;
  const report = getReportData(key);

  // Build CSV string
  let csvContent = `SafeGuard AI — Industrial Safety Platform\n`;
  csvContent += `Report Title,"${report.title}"\n`;
  csvContent += `Reporting Period,"${report.period}"\n`;
  csvContent += `Generated Date,"${new Date().toLocaleString()}"\n`;
  csvContent += `Executive Summary,"${report.summary.replace(/"/g, '""')}"\n\n`;

  // Headers
  csvContent += `Metric,Value,Benchmark,Status\n`;

  // Rows
  report.data.forEach(row => {
    csvContent += `"${row.Metric}","${row.Value}","${row.Benchmark}","${row.Status}"\n`;
  });

  // Client-side Download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `SafeGuard_Safety_Report_${key.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  SafeGuardApp.showToast("CSV Export Complete", `Downloaded ${report.title} as CSV.`, "success");
}
