/**
 * SafeGuard AI — Primary Application Controller & Reactive State Store
 * Pure Vanilla JavaScript (No frameworks, pure client-side execution)
 */

const SafeGuardState = {
  STORAGE_KEY: "safeguard_ai_state_clean_v3",

  _cachedState: null,
  _lastStoredRaw: "",

  // Initial State Factory (Clean Production Baseline - Zero Demo Data)
  getDefaults() {
    return {
      facility: "Pune Manufacturing Plant",
      user: {
        name: "Vikram Malhotra",
        role: "Safety Officer",
        email: "v.malhotra@safeguard.ai",
        badge: "SO-8821",
        department: "EHS Operations"
      },
      roles: [
        { id: "role-so", title: "Safety Officer", clearance: "Level 4 (Admin)", description: "Full EHS supervisory clearance, alert dispatch, and site inspection management.", userCount: 1 },
        { id: "role-sup", title: "Site Supervisor", clearance: "Level 3 (Operational)", description: "Floor supervision, worker PPE compliance inspection, and shift sign-off.", userCount: 3 },
        { id: "role-mgr", title: "EHS Manager", clearance: "Level 4 (Admin)", description: "Facility-wide regulatory reporting, policy thresholds, and audit trails.", userCount: 1 },
        { id: "role-marsh", title: "Emergency Marshal", clearance: "Level 3 (Operational)", description: "Immediate physical intervention, evacuation control, and alarm triggers.", userCount: 2 },
        { id: "role-aud", title: "Compliance Auditor", clearance: "Level 2 (Read-Only)", description: "Historical incident review, telemetry inspection, and report export.", userCount: 2 },
        { id: "role-wrk", title: "Plant Worker", clearance: "Level 1 (Standard)", description: "Badge recognition, automated PPE verification, and individual safety scoring.", userCount: 45 }
      ],
      theme: "dark",
      demoMode: false,
      simulationPaused: true,
      presentationMode: false,
      kpis: {
        safetyScore: 100,
        activeWorkers: 0,
        activeAlerts: 0,
        criticalAlerts: 0,
        todayIncidents: 0,
        ppeCompliance: 100.0,
        highRiskZones: 0,
        activeCameras: 24,
        totalCameras: 24
      },
      twoSidedRisk: {
        workerSafety: {
          score: 100,
          ppe: 100,
          training: 100,
          zoneCompliance: 100
        },
        zoneRisk: {
          score: 0,
          activeHazards: 0,
          incidents: 0,
          anomalies: 0
        },
        aiPriority: "Optimal Safety: All facility operations operating within nominal parameters."
      },
      ppeComplianceDetailed: {
        helmet: 100.0,
        vest: 100.0,
        overall: 100.0,
        byDay: [100, 100, 100, 100, 100, 100, 100],
        byZone: [100, 100, 100, 100, 100],
        byShift: [100, 100, 100]
      },
      aiDetectionMetrics: {
        detectionsToday: 0,
        safetyViolations: 0,
        criticalDetections: 0,
        aiConfidence: 99.4
      },
      sensors: {
        gas: { value: 420, unit: "ppm", status: "Normal", threshold: 800 },
        temperature: { value: 26.8, unit: "°C", status: "Normal", threshold: 45.0 },
        smoke: { value: 4, unit: "ppm", status: "Normal", threshold: 25 },
        humidity: { value: 52, unit: "%", status: "Normal", threshold: 80 },
        motion: { value: "Normal", status: "Active" }
      },
      zones: [
        {
          id: "zone-b",
          code: "ZONE-B",
          name: "Machine Shop & Fabrication",
          wing: "Central Industrial Bay",
          cameras: ["CAM-03", "CAM-04", "CAM-05"],
          activeWorkers: 8,
          recordedViolations: {
            helmet: 4,
            vest: 2,
            both: 2,
            total: 8
          },
          complianceRate: 64.2,
          riskScore: 82,
          status: "CRITICAL",
          inspectionStatus: "Immediate Inspection Required",
          lastInspection: "4 hours ago (Overdue)",
          inspector: "Officer Vikram Malhotra",
          airQuality: "Nominal (VOC: 18ppm)",
          machineryInterlock: "Engaged"
        },
        {
          id: "zone-c",
          code: "ZONE-C",
          name: "Chemical & Hazardous Storage",
          wing: "South Storage Wing",
          cameras: ["CAM-06", "CAM-07"],
          activeWorkers: 4,
          recordedViolations: {
            helmet: 3,
            vest: 2,
            both: 1,
            total: 6
          },
          complianceRate: 72.5,
          riskScore: 78,
          status: "HIGH",
          inspectionStatus: "Inspection Dispatched",
          lastInspection: "1.5 hours ago",
          inspector: "Officer Rajesh Sharma",
          airQuality: "Ventilation Active (420ppm Gas)",
          machineryInterlock: "Standby"
        },
        {
          id: "zone-f",
          code: "ZONE-F",
          name: "Scaffolding & Structural Roofing",
          wing: "Exterior Overhead Grid",
          cameras: ["CAM-11", "CAM-12"],
          activeWorkers: 5,
          recordedViolations: {
            helmet: 2,
            vest: 2,
            both: 0,
            total: 4
          },
          complianceRate: 78.0,
          riskScore: 65,
          status: "WARNING",
          inspectionStatus: "Inspection Recommended",
          lastInspection: "2.5 hours ago",
          inspector: "Officer Anita Rao",
          airQuality: "Outdoor Ambient",
          machineryInterlock: "Fall Arrest Active"
        },
        {
          id: "zone-a",
          code: "ZONE-A",
          name: "Robotic Assembly & Conveyors",
          wing: "East Manufacturing Wing",
          cameras: ["CAM-01", "CAM-02"],
          activeWorkers: 12,
          recordedViolations: {
            helmet: 1,
            vest: 1,
            both: 0,
            total: 2
          },
          complianceRate: 91.6,
          riskScore: 28,
          status: "MODERATE",
          inspectionStatus: "Routine Patrol Scheduled",
          lastInspection: "45 minutes ago",
          inspector: "Officer Vikram Malhotra",
          airQuality: "Optimal (Dust: Low)",
          machineryInterlock: "Nominal"
        },
        {
          id: "zone-d",
          code: "ZONE-D",
          name: "High-Bay Storage Warehouse",
          wing: "North Logistics Wing",
          cameras: ["CAM-08", "CAM-09", "CAM-10"],
          activeWorkers: 9,
          recordedViolations: {
            helmet: 1,
            vest: 0,
            both: 0,
            total: 1
          },
          complianceRate: 94.8,
          riskScore: 22,
          status: "SAFE",
          inspectionStatus: "Inspection Clear",
          lastInspection: "20 minutes ago",
          inspector: "Officer Sneha Patil",
          airQuality: "Nominal",
          machineryInterlock: "Automated Forklifts Guided"
        },
        {
          id: "zone-e",
          code: "ZONE-E",
          name: "Logistics & Fleet Loading Docks",
          wing: "West Transit Bay",
          cameras: ["CAM-13", "CAM-14"],
          activeWorkers: 7,
          recordedViolations: {
            helmet: 0,
            vest: 0,
            both: 0,
            total: 0
          },
          complianceRate: 100.0,
          riskScore: 12,
          status: "SAFE",
          inspectionStatus: "All Clear / Verified",
          lastInspection: "10 minutes ago",
          inspector: "Officer Sunil Verma",
          airQuality: "Good (Exhaust Active)",
          machineryInterlock: "Dock Locks Secure"
        }
      ],
      workers: [],
      alerts: [],
      incidents: [],
      settings: {
        criticalSms: true,
        emailNotifications: true,
        mobilePush: true,
        faceBlurring: true,
        soundChime: true,
        autoSimulation: false,
        thresholdGas: 800,
        thresholdTemp: 45,
        thresholdSmoke: 25,
        dataRetentionDays: 90
      },
      auditLogs: [
        { time: "Online", action: "SafeGuard AI System Online — All nodes reporting nominal status", user: "SafeGuard Core" }
      ]
    };
  },

  // Get current state with robust defaults merging and in-memory cache
  getState() {
    // Automatically purge old demo storage if present
    try {
      localStorage.removeItem("safeguard_ai_state_clean_v2");
      localStorage.removeItem("safeguard_ai_state_v1");
      localStorage.removeItem("safeguard_ai_state");
    } catch(e) {}

    const def = this.getDefaults();
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this._lastStoredRaw = stored;
        const parsed = JSON.parse(stored);
        const res = {
          ...def,
          ...parsed,
          zones: (Array.isArray(parsed.zones) && parsed.zones.length > 0) ? parsed.zones : def.zones,
          roles: (Array.isArray(parsed.roles) && parsed.roles.length > 0) ? parsed.roles : def.roles,
          workers: Array.isArray(parsed.workers) ? parsed.workers : [],
          alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
          incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : def.auditLogs,
          kpis: { ...def.kpis, ...(parsed.kpis || {}) },
          twoSidedRisk: { ...def.twoSidedRisk, ...(parsed.twoSidedRisk || {}) },
          sensors: { ...def.sensors, ...(parsed.sensors || {}) },
          settings: { ...def.settings, ...(parsed.settings || {}) },
          user: { ...def.user, ...(parsed.user || {}) }
        };
        res.kpis.activeWorkers = res.workers.length;
        res.kpis.activeAlerts = res.alerts.filter(a => a.status === "Active").length;
        res.kpis.criticalAlerts = res.alerts.filter(a => a.severity === "CRITICAL" && a.status === "Active").length;
        res.kpis.todayIncidents = res.incidents.length;
        this._cachedState = res;
        return res;
      }
    } catch (e) {
      console.warn("Error reading localStorage, using cached or defaults", e);
    }

    if (this._cachedState) {
      return this._cachedState;
    }

    this.saveState(def);
    return def;
  },

  // Multi-tier storage with quota guard
  saveState(state) {
    this._cachedState = state;
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(this.STORAGE_KEY, json);
      this._lastStoredRaw = json;
    } catch (e) {
      console.warn("Storage quota hit or storage error, attempting tiered snapshot trimming", e);
      try {
        // Tier 1: Keep only the 3 latest snapshots, drop older ones
        if (state.alerts && state.alerts.length > 3) {
          state.alerts.slice(3).forEach(a => { delete a.snapshot; });
          const json1 = JSON.stringify(state);
          localStorage.setItem(this.STORAGE_KEY, json1);
          this._lastStoredRaw = json1;
          return;
        }
      } catch (e2) {}

      try {
        // Tier 2: Keep only 1 latest snapshot
        if (state.alerts && state.alerts.length > 1) {
          state.alerts.slice(1).forEach(a => { delete a.snapshot; });
          const json2 = JSON.stringify(state);
          localStorage.setItem(this.STORAGE_KEY, json2);
          this._lastStoredRaw = json2;
          return;
        }
      } catch (e3) {}

      try {
        // Tier 3: Strip all snapshots from alerts entirely
        if (state.alerts) {
          state.alerts.forEach(a => { delete a.snapshot; });
          const json3 = JSON.stringify(state);
          localStorage.setItem(this.STORAGE_KEY, json3);
          this._lastStoredRaw = json3;
        }
      } catch (e4) {
        console.error("Failed to save state to localStorage even after trimming", e4);
      }
    }
  },

  update(updater) {
    let state = this.getState();
    if (!state.alerts) state.alerts = [];
    if (!state.incidents) state.incidents = [];
    if (!state.auditLogs) state.auditLogs = [];
    if (!state.workers) state.workers = [];
    if (!state.kpis) state.kpis = {};

    let updated = state;
    try {
      const res = updater(state);
      if (res) updated = res;
    } catch (err) {
      console.error("SafeGuardState.update error in updater callback:", err);
    }

    if (!updated.alerts) updated.alerts = [];
    if (!updated.incidents) updated.incidents = [];
    if (!updated.auditLogs) updated.auditLogs = [];
    if (!updated.workers) updated.workers = [];
    if (!updated.kpis) updated.kpis = {};

    updated.kpis.activeWorkers = updated.workers.length;
    updated.kpis.activeAlerts = updated.alerts.filter(a => a.status === "Active").length;
    updated.kpis.criticalAlerts = updated.alerts.filter(a => a.severity === "CRITICAL" && a.status === "Active").length;
    updated.kpis.todayIncidents = updated.incidents.length;

    this.saveState(updated);

    // Broadcast in current window
    try {
      window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: updated }));
    } catch (e) {}

    // Broadcast across tabs via BroadcastChannel if available
    try {
      if (window.SafeGuardChannel) {
        window.SafeGuardChannel.postMessage({ type: "state_changed", timestamp: Date.now() });
      }
    } catch (e) {}

    return updated;
  },

  // Factory reset: clear all local storage and return clean default baseline
  resetAll() {
    this._cachedState = null;
    this._lastStoredRaw = "";
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem("safeguard_ai_state_clean_v2");
      localStorage.removeItem("safeguard_ai_state_v1");
      localStorage.removeItem("safeguard_ai_state");
    } catch (e) {}

    const defaults = this.getDefaults();
    this.saveState(defaults);

    try {
      window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: defaults }));
      if (window.SafeGuardChannel) {
        window.SafeGuardChannel.postMessage({ type: "state_changed", timestamp: Date.now() });
      }
    } catch (e) {}

    return defaults;
  },

  recordZonePPEViolation(zoneId = "zone-b", violationType = "helmet") {
    return this.update(state => {
      state.zones = state.zones || [];
      const z = state.zones.find(zone => zone.id === zoneId) || state.zones[0];
      if (z) {
        if (!z.recordedViolations) {
          z.recordedViolations = { helmet: 0, vest: 0, both: 0, total: 0 };
        }
        if (violationType === "both") {
          z.recordedViolations.both = (z.recordedViolations.both || 0) + 1;
        } else if (violationType === "helmet") {
          z.recordedViolations.helmet = (z.recordedViolations.helmet || 0) + 1;
        } else if (violationType === "vest") {
          z.recordedViolations.vest = (z.recordedViolations.vest || 0) + 1;
        }
        z.recordedViolations.total = (z.recordedViolations.helmet || 0) + (z.recordedViolations.vest || 0) + (z.recordedViolations.both || 0);

        // Adjust risk score & compliance dynamically
        z.riskScore = Math.min(100, (z.riskScore || 20) + (violationType === "both" ? 8 : 4));
        z.complianceRate = Math.max(40, +(100 - (z.recordedViolations.total * 4.5)).toFixed(1));

        if (z.recordedViolations.total >= 4 || z.riskScore >= 75) {
          z.status = "CRITICAL";
          z.inspectionStatus = "Immediate Inspection Required";
        } else if (z.recordedViolations.total >= 2 || z.riskScore >= 50) {
          z.status = "HIGH";
          z.inspectionStatus = "Elevated Inspection Priority";
        } else {
          z.status = "MODERATE";
          z.inspectionStatus = "Routine Patrol Scheduled";
        }
      }
      return state;
    });
  },

  dispatchZoneInspection(zoneId, officerName = "Officer Vikram Malhotra") {
    return this.update(state => {
      state.zones = state.zones || [];
      const z = state.zones.find(zone => zone.id === zoneId);
      if (z) {
        z.inspectionStatus = "Officer Dispatched (On-Site)";
        z.lastInspection = "Just now (Dispatched)";
        z.inspector = officerName;
        z.riskScore = Math.max(15, z.riskScore - 12);
      }
      state.auditLogs = state.auditLogs || [];
      state.auditLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: `🚨 Inspection Dispatched: Safety Officer assigned to ${z ? z.name : zoneId} for mandatory PPE compliance audit.`,
        user: officerName
      });
      return state;
    });
  },

  addAlert(alertData) {
    return this.update(state => {
      state.alerts = state.alerts || [];
      const newAlert = {
        id: alertData.id || `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
        severity: alertData.severity || "HIGH",
        severityClass: (alertData.severity === "CRITICAL") ? "critical-alert" : "high-alert",
        title: alertData.title || "Safety Alert",
        description: alertData.description || "",
        location: alertData.zone || "Plant Floor",
        timeAgo: "Just now",
        timestamp: new Date().toISOString(),
        status: "Active"
      };
      state.alerts.unshift(newAlert);
      if (state.alerts.length > 50) state.alerts = state.alerts.slice(0, 50);
      return state;
    });
  },

  addZone(zoneData) {
    return this.update(state => {
      state.zones = state.zones || [];
      const newZone = {
        id: zoneData.id || `zone-${Date.now().toString(36)}`,
        code: zoneData.code ? zoneData.code.trim().toUpperCase() : `ZONE-${String.fromCharCode(65 + state.zones.length)}`,
        name: zoneData.name ? zoneData.name.trim() : "New Industrial Zone",
        wing: zoneData.wing ? zoneData.wing.trim() : "Plant Operations Wing",
        cameras: Array.isArray(zoneData.cameras) ? zoneData.cameras : (zoneData.cameras ? zoneData.cameras.split(",").map(c => c.trim()) : ["CAM-01"]),
        activeWorkers: Number(zoneData.activeWorkers) || 0,
        recordedViolations: {
          helmet: Number(zoneData.helmetViolations) || 0,
          vest: Number(zoneData.vestViolations) || 0,
          both: Number(zoneData.bothViolations) || 0,
          total: (Number(zoneData.helmetViolations) || 0) + (Number(zoneData.vestViolations) || 0) + (Number(zoneData.bothViolations) || 0)
        },
        riskScore: Number(zoneData.riskScore) || 25,
        status: (Number(zoneData.riskScore) >= 75) ? "CRITICAL" : ((Number(zoneData.riskScore) >= 50) ? "HIGH" : ((Number(zoneData.riskScore) >= 25) ? "WARNING" : "SAFE")),
        inspectionStatus: zoneData.inspectionStatus || "Routine Patrol Scheduled",
        lastInspection: "Just now (Created)",
        inspector: zoneData.inspector || (state.user?.name || "Officer Vikram Malhotra"),
        airQuality: zoneData.airQuality || "Nominal",
        machineryInterlock: zoneData.machineryInterlock || "Active"
      };
      newZone.complianceRate = typeof zoneData.complianceRate === "number" ? zoneData.complianceRate : Math.max(30, +(100 - newZone.riskScore * 0.7).toFixed(1));

      state.zones.push(newZone);
      state.auditLogs = state.auditLogs || [];
      state.auditLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: `➕ Site Zone Added: ${newZone.name} (${newZone.code}) configured with Risk Score ${newZone.riskScore}/100.`,
        user: state.user?.name || "System Admin"
      });
      return state;
    });
  },

  updateZone(zoneId, updatedData) {
    return this.update(state => {
      state.zones = state.zones || [];
      const z = state.zones.find(zone => zone.id === zoneId);
      if (z) {
        if (updatedData.name !== undefined) z.name = updatedData.name.trim();
        if (updatedData.code !== undefined) z.code = updatedData.code.trim().toUpperCase();
        if (updatedData.wing !== undefined) z.wing = updatedData.wing.trim();
        if (updatedData.riskScore !== undefined) {
          z.riskScore = Number(updatedData.riskScore);
          z.status = (z.riskScore >= 75) ? "CRITICAL" : ((z.riskScore >= 50) ? "HIGH" : ((z.riskScore >= 25) ? "WARNING" : "SAFE"));
        }
        if (updatedData.activeWorkers !== undefined) z.activeWorkers = Number(updatedData.activeWorkers);
        if (updatedData.cameras !== undefined) {
          z.cameras = Array.isArray(updatedData.cameras) ? updatedData.cameras : updatedData.cameras.split(",").map(c => c.trim());
        }
        if (updatedData.inspectionStatus !== undefined) z.inspectionStatus = updatedData.inspectionStatus;
        if (updatedData.inspector !== undefined) z.inspector = updatedData.inspector;
        if (updatedData.airQuality !== undefined) z.airQuality = updatedData.airQuality;
        if (updatedData.recordedViolations !== undefined) {
          z.recordedViolations = updatedData.recordedViolations;
          z.recordedViolations.total = (z.recordedViolations.helmet || 0) + (z.recordedViolations.vest || 0) + (z.recordedViolations.both || 0);
        }
        z.complianceRate = Math.max(20, +(100 - (z.riskScore * 0.7)).toFixed(1));

        state.auditLogs = state.auditLogs || [];
        state.auditLogs.unshift({
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: `✏️ Site Zone Updated: ${z.name} (${z.code}) risk score adjusted to ${z.riskScore}/100.`,
          user: state.user?.name || "System Admin"
        });
      }
      return state;
    });
  },

  removeZone(zoneId) {
    return this.update(state => {
      state.zones = state.zones || [];
      const target = state.zones.find(z => z.id === zoneId);
      const name = target ? target.name : zoneId;
      state.zones = state.zones.filter(z => z.id !== zoneId);
      state.auditLogs = state.auditLogs || [];
      state.auditLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: `🗑️ Site Zone Removed: ${name} deleted from active plant monitoring registry.`,
        user: state.user?.name || "System Admin"
      });
      return state;
    });
  },

  updateUserProfile(userData) {
    return this.update(state => {
      state.user = state.user || {};
      const oldName = state.user.name;
      const oldRole = state.user.role;
      if (userData.name) state.user.name = userData.name.trim();
      if (userData.role) state.user.role = userData.role.trim();
      if (userData.email) state.user.email = userData.email.trim();
      if (userData.badge) state.user.badge = userData.badge.trim();
      if (userData.department) state.user.department = userData.department.trim();

      state.auditLogs = state.auditLogs || [];
      state.auditLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: `👤 User Profile Updated: ${oldName} (${oldRole}) → ${state.user.name} (${state.user.role}).`,
        user: state.user.name
      });
      return state;
    });
  },

  addRole(roleData) {
    return this.update(state => {
      state.roles = state.roles || [];
      const newRole = {
        id: `role-${Date.now().toString(36)}`,
        title: roleData.title ? roleData.title.trim() : "Custom Role",
        clearance: roleData.clearance || "Level 3 (Operational)",
        description: roleData.description ? roleData.description.trim() : "Custom operational responsibilities.",
        userCount: 0
      };
      state.roles.push(newRole);
      state.auditLogs = state.auditLogs || [];
      state.auditLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: `🔑 Role Added: New credential role "${newRole.title}" registered in system.`,
        user: state.user?.name || "System Admin"
      });
      return state;
    });
  },

  updateRole(roleId, updatedData) {
    return this.update(state => {
      state.roles = state.roles || [];
      const r = state.roles.find(role => role.id === roleId);
      if (r) {
        const oldTitle = r.title;
        if (updatedData.title) r.title = updatedData.title.trim();
        if (updatedData.clearance) r.clearance = updatedData.clearance.trim();
        if (updatedData.description) r.description = updatedData.description.trim();

        if (state.user && state.user.role === oldTitle) {
          state.user.role = r.title;
        }

        state.auditLogs = state.auditLogs || [];
        state.auditLogs.unshift({
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: `✏️ Role Modified: "${oldTitle}" updated to "${r.title}".`,
          user: state.user?.name || "System Admin"
        });
      }
      return state;
    });
  },

  removeRole(roleId) {
    return this.update(state => {
      state.roles = state.roles || [];
      const target = state.roles.find(r => r.id === roleId);
      const title = target ? target.title : roleId;
      state.roles = state.roles.filter(r => r.id !== roleId);
      state.auditLogs = state.auditLogs || [];
      state.auditLogs.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: `🗑️ Role Deleted: "${title}" removed from credential role registry.`,
        user: state.user?.name || "System Admin"
      });
      return state;
    });
  }
};

// Explicitly bind to window for cross-script access
window.SafeGuardState = SafeGuardState;

// Cross-tab broadcast channel for instant multi-window sync
try {
  if (typeof BroadcastChannel !== "undefined") {
    window.SafeGuardChannel = new BroadcastChannel("safeguard_sync_channel");
    window.SafeGuardChannel.onmessage = (event) => {
      if (event && event.data && event.data.type === "state_changed") {
        const freshState = SafeGuardState.getState();
        window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: freshState }));
      }
    };
  }
} catch (e) {}

/**
 * Global SafeGuard Application Controller
 */
const SafeGuardApp = {
  audioCtx: null,

  getBackendUrl() {
    return localStorage.getItem("safeguard_backend_url") || "http://127.0.0.1:8000";
  },

  async syncWorkersWithBackend() {
    const url = this.getBackendUrl();
    try {
      const res = await fetch(`${url}/api/workers`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) return;
      const data = await res.json();
      const backendWorkers = data.workers || [];
      if (!Array.isArray(backendWorkers) || backendWorkers.length === 0) return;

      SafeGuardState.update(state => {
        state.workers = state.workers || [];
        backendWorkers.forEach(bw => {
          const wId = bw.id || bw.worker_id;
          if (!wId) return;
          const idx = state.workers.findIndex(w => (w.id === wId || w.worker_id === wId));
          if (idx >= 0) {
            state.workers[idx] = { ...state.workers[idx], ...bw, id: wId, worker_id: wId };
          } else {
            state.workers.push({
              id: wId,
              worker_id: wId,
              name: bw.name || bw.worker_name || "Registered Worker",
              department: bw.department || "Assembly Operations",
              location: bw.location || "Pune Plant Floor",
              shift: bw.shift || "Morning (06:00 - 14:00)",
              ppe: bw.ppe || 100,
              safetyScore: bw.safetyScore || 100,
              status: bw.status || "Safe",
              incidents: bw.incidents || 0,
              nearMisses: bw.nearMisses || 0,
              trainingStatus: bw.trainingStatus || bw.role || "Certified (Level 3)",
              faceImage: bw.faceImage || bw.face_image || null,
              multiAnglePhotos: bw.multiAnglePhotos || bw.multi_angle_photos || null,
              faceSignatures: bw.faceSignatures || bw.face_signatures || null,
              breakdown: bw.breakdown || { helmet: 100, vest: 100, restrictedZone: 100, training: 100 }
            });
          }
        });
        state.kpis.activeWorkers = state.workers.length;
        return state;
      });

      if (window.LiveCameraDetector && typeof window.LiveCameraDetector.invalidateFaceCache === "function") {
        window.LiveCameraDetector.invalidateFaceCache();
      }
      if (window.MultiWorkerPPEDetector && typeof window.MultiWorkerPPEDetector.invalidateFaceCache === "function") {
        window.MultiWorkerPPEDetector.invalidateFaceCache();
      }
    } catch (e) {
      // Backend offline or unreachable
    }
  },

  init() {
    this.applyTheme();
    this.bindGlobalEvents();
    this.setupGlobalSearch();
    this.renderTopBarState();
    this.renderNotificationsDropdown();
    this.startSimulationEngine();
    this.highlightActiveNav();
    this.syncWorkersWithBackend();
  },

  // Highlight active sidebar navigation link based on current page
  highlightActiveNav() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".nav-item").forEach(item => {
      const href = item.getAttribute("href");
      if (href && (href === currentPath || href.startsWith(currentPath))) {
        document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");
      }
    });
  },

  // Synthesized Web Audio Chime (Zero external files needed)
  playAudioChime(isCritical = false) {
    const state = SafeGuardState.getState();
    if (!state.settings || !state.settings.soundChime) return;

    try {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioCtx = new AudioContext();
      }
      if (!this.audioCtx) return;
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = isCritical ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(isCritical ? 880 : 540, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isCritical ? 440 : 800, this.audioCtx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch (e) {
      // Audio autoplay policy handled silently
    }
  },

  // Toggle Dark/Light Theme
  applyTheme() {
    const savedTheme = localStorage.getItem("safeguard_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.innerHTML = savedTheme === "dark" ? "🌙" : "☀️";
    }
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("safeguard_theme", next);
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.innerHTML = next === "dark" ? "🌙" : "☀️";
    }
    this.showToast("Theme Changed", `Switched to ${next} mode.`, "info");
  },

  // Mobile Sidebar Toggle
  toggleMobileSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
      sidebar.classList.toggle("mobile-open");
    }
  },

  // Presentation/Viva Mode (Decommissioned)
  togglePresentationMode() {},

  // Setup Global Search with Interactive Dropdown Popup
  setupGlobalSearch() {
    const searchInputs = document.querySelectorAll(".search-bar input");
    if (!searchInputs.length) return;

    searchInputs.forEach(input => {
      input.addEventListener("input", (e) => this.handleGlobalSearch(e.target.value, input));
      input.addEventListener("focus", (e) => {
        if (e.target.value.trim().length > 1) this.handleGlobalSearch(e.target.value, input);
      });
    });

    document.addEventListener("click", (e) => {
      const popup = document.getElementById("global-search-popup");
      if (popup && !popup.contains(e.target) && !e.target.closest(".search-bar")) {
        popup.remove();
      }
    });
  },

  handleGlobalSearch(query, inputElement) {
    const q = query.toLowerCase().trim();
    let popup = document.getElementById("global-search-popup");

    if (q.length < 2) {
      if (popup) popup.remove();
      return;
    }

    if (!popup) {
      popup = document.createElement("div");
      popup.id = "global-search-popup";
      popup.style.position = "absolute";
      popup.style.top = "calc(100% + 8px)";
      popup.style.left = "0";
      popup.style.right = "0";
      popup.style.backgroundColor = "var(--card)";
      popup.style.border = "1px solid var(--border)";
      popup.style.borderRadius = "var(--radius-md)";
      popup.style.boxShadow = "0 12px 30px rgba(0,0,0,0.6)";
      popup.style.zIndex = "1200";
      popup.style.maxHeight = "340px";
      popup.style.overflowY = "auto";
      popup.style.padding = "8px 0";
    }

    inputElement.parentElement.style.position = "relative";
    inputElement.parentElement.appendChild(popup);

    const state = SafeGuardState.getState();
    const matchedWorkers = state.workers.filter(w => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
    const matchedAlerts = state.alerts.filter(a => a.title.toLowerCase().includes(q) || (a.details || "").toLowerCase().includes(q));

    if (!matchedWorkers.length && !matchedAlerts.length) {
      popup.innerHTML = `<div style="padding:14px; text-align:center; font-size:0.85rem; color:var(--text-secondary);">No records matching "${query}"</div>`;
      return;
    }

    let html = "";
    if (matchedWorkers.length) {
      html += `<div style="padding:6px 14px; font-size:0.75rem; color:var(--cyan); font-weight:700; text-transform:uppercase;">Workers</div>`;
      matchedWorkers.slice(0, 3).forEach(w => {
        html += `
          <div style="padding:8px 14px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onmouseover="this.style.background='var(--card-hover)'" onmouseout="this.style.background='transparent'" onclick="window.location.href='workers.html'">
            <div><strong>${w.name}</strong> <span class="mono text-cyan" style="font-size:0.8rem;">${w.id}</span></div>
            <span class="badge badge-blue">${w.department}</span>
          </div>`;
      });
    }

    if (matchedAlerts.length) {
      html += `<div style="padding:6px 14px; font-size:0.75rem; color:var(--danger); font-weight:700; text-transform:uppercase; margin-top:6px;">Alerts</div>`;
      matchedAlerts.slice(0, 3).forEach(a => {
        html += `
          <div style="padding:8px 14px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onmouseover="this.style.background='var(--card-hover)'" onmouseout="this.style.background='transparent'" onclick="window.location.href='alerts.html'">
            <div style="font-size:0.85rem;"><strong>${a.title}</strong></div>
            <span class="badge ${a.severity === 'CRITICAL' ? 'badge-danger' : 'badge-warning'}">${a.severity}</span>
          </div>`;
      });
    }

    popup.innerHTML = html;
  },

  // Global Event Bindings
  bindGlobalEvents() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.show").forEach(m => m.classList.remove("show"));
      }
    });

    document.addEventListener("click", (e) => {
      const notifWrapper = document.getElementById("notif-wrapper");
      const notifDropdown = document.getElementById("notif-dropdown");
      if (notifDropdown && notifWrapper && !notifWrapper.contains(e.target)) {
        notifDropdown.classList.remove("show");
      }
    });

    window.addEventListener("safeguard_state_changed", () => {
      this.renderTopBarState();
      this.renderNotificationsDropdown();
    });

    // Cross-tab real-time synchronization
    window.addEventListener("storage", (e) => {
      if (e.key === SafeGuardState.STORAGE_KEY) {
        const newState = SafeGuardState.getState();
        window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: newState }));
      }
    });

    // Re-sync on window focus and tab visibility change (critical for file:/// multi-tab browsing)
    window.addEventListener("focus", () => {
      const newState = SafeGuardState.getState();
      window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: newState }));
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        const newState = SafeGuardState.getState();
        window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: newState }));
      }
    });

    // Periodic heartbeat check (every 800ms) to ensure state parity across tabs on file:/// origins
    setInterval(() => {
      try {
        const stored = localStorage.getItem(SafeGuardState.STORAGE_KEY);
        if (stored && stored !== SafeGuardState._lastStoredRaw) {
          SafeGuardState._lastStoredRaw = stored;
          const newState = SafeGuardState.getState();
          window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: newState }));
        }
      } catch (e) {}
    }, 800);
  },

  // Render TopBar Notifications & Badges
  renderTopBarState() {
    const state = SafeGuardState.getState();
    const notifCount = document.getElementById("topbar-notif-count");
    if (notifCount) {
      const activeCount = (state.alerts || []).filter(a => a.status === "Active").length;
      notifCount.textContent = activeCount;
      notifCount.style.display = activeCount > 0 ? "flex" : "none";
    }

    const simToggleBtn = document.getElementById("demo-sim-toggle");
    if (simToggleBtn) {
      simToggleBtn.style.display = "none";
    }

    // Dynamic user badge update
    document.querySelectorAll(".user-profile-badge").forEach(badge => {
      const nameEl = badge.querySelector("div > div:first-child");
      const roleEl = badge.querySelector("div > div:last-child");
      const avatarEl = badge.querySelector(".user-avatar");
      if (nameEl) nameEl.textContent = state.user.name;
      if (roleEl) roleEl.textContent = state.user.role;
      if (avatarEl) {
        const parts = (state.user.name || "VM").trim().split(/\s+/).filter(Boolean);
        avatarEl.textContent = parts.map(n => n[0]).slice(0, 2).join("").toUpperCase() || "VM";
      }
    });
  },

  toggleNotificationDropdown() {
    const notifDropdown = document.getElementById("notif-dropdown");
    if (notifDropdown) {
      notifDropdown.classList.toggle("show");
    }
  },

  renderNotificationsDropdown() {
    const list = document.getElementById("notif-list-items");
    if (!list) return;

    const state = SafeGuardState.getState();
    const activeAlerts = (state.alerts || []).filter(a => a.status === "Active").slice(0, 5);

    if (activeAlerts.length === 0) {
      list.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-secondary); font-size:0.85rem;">No active alerts at this moment.</div>`;
      return;
    }

    list.innerHTML = activeAlerts.map(a => {
      let icon = "🟡";
      if (a.severity === "CRITICAL") icon = "🔴";
      if (a.severity === "HIGH") icon = "🟠";

      return `
        <div class="notif-item" onclick="window.location.href='alerts.html'">
          <div style="font-size:1.2rem;">${icon}</div>
          <div style="flex:1;">
            <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">${a.title}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
              ${a.timeAgo}${a.worker ? ` • <span style="color:var(--cyan); font-weight:600;">👷 ${a.worker}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join("");
  },

  // Toast Notification System
  showToast(title, description, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "ℹ️";
    if (type === "danger") icon = "🚨";
    if (type === "warning") icon = "⚠️";
    if (type === "success") icon = "✅";

    toast.innerHTML = `
      <div style="font-size:1.3rem;">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-desc">${description}</div>
      </div>
    `;

    container.appendChild(toast);

    if (type === "danger") {
      this.playAudioChime(true);
    } else if (type === "warning") {
      this.playAudioChime(false);
    }

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(50px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  // Modal Controllers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("show");
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove("show");
    }
  },

  // Toggle Demo Simulation Pause/Resume (Requirement 19)
  toggleDemoSimulation() {
    const updated = SafeGuardState.update(state => {
      state.simulationPaused = !state.simulationPaused;
      return state;
    });
    this.renderTopBarState();
    this.showToast(
      updated.simulationPaused ? "Simulation Paused" : "Simulation Resumed",
      updated.simulationPaused ? "Random alert generation paused for demonstration." : "Background real-time telemetry generation resumed.",
      "info"
    );
  },

  // Real-time Background Alert Generator (Disabled in clean production mode)
  startSimulationEngine() {
    // Disabled in clean production mode.
    // Alerts are only dispatched by actual computer vision detections or manual officer inputs.
  },

  /**
   * REQUIREMENT 39: THE MOST IMPORTANT DEMO FLOW
   */
  triggerWorker117DemoFlow() {
    this.showToast("⚡ Demo Triggered", "Step 1: AI Vision Model scanning CAM-01 Assembly Zone...", "info");

    // If on monitoring.html, visibly switch bounding box to flashing red violation box
    const cam01PersonBox = document.getElementById("cam01-worker-bbox");
    if (cam01PersonBox) {
      cam01PersonBox.className = "ai-bbox bbox-violation";
      const lbl = cam01PersonBox.querySelector(".bbox-label");
      if (lbl) lbl.textContent = "NO HELMET (Worker #117) 97.4%";
    }

    setTimeout(() => {
      const incidentId = `INC-2026-00${Math.floor(85 + Math.random() * 10)}`;
      const alertId = `ALT-9117`;

      SafeGuardState.update(state => {
        const targetWorker = (state.workers && state.workers.length > 0) ? state.workers[0] : null;
        const workerLabel = targetWorker ? `${targetWorker.name} (${targetWorker.id})` : "Unregistered Personnel";

        const newAlert = {
          id: alertId,
          severity: "CRITICAL",
          severityClass: "critical-alert",
          title: `PPE Violation Detected: Missing helmet (${workerLabel})`,
          location: "Assembly Floor",
          timeAgo: "Just now",
          timestamp: new Date().toISOString(),
          details: `YOLOv8 Safety Model detected ${workerLabel} operating in high-overhead conveyor bay without mandatory hardhat (Confidence: 97.4%).`,
          status: "Active"
        };

        state.alerts.unshift(newAlert);
        state.kpis.activeAlerts += 1;
        state.kpis.criticalAlerts += 1;
        state.kpis.todayIncidents += 1;
        state.kpis.safetyScore = Math.max(70, state.kpis.safetyScore - 2);

        if (targetWorker) {
          targetWorker.ppe = 82;
          targetWorker.safetyScore = 81;
          targetWorker.status = "Warning";
          targetWorker.incidents = (targetWorker.incidents || 0) + 1;
          if (targetWorker.breakdown) targetWorker.breakdown.helmet = 70;
        }

        const newIncident = {
          id: incidentId,
          type: "PPE Violation (No Helmet)",
          location: "Assembly Floor",
          severity: "High",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: "Open",
          officer: "Officer 01 (Auto-Assigned)",
          description: "Automated vision trigger: Worker #117 observed without safety helmet under mechanical conveyor. Alarm sounded.",
          evidence: "CAM-01 Live Frame Detection BBox #0117",
          actionTaken: "Audio chime emitted on floor speaker; supervisor notified via dispatch."
        };
        state.incidents.unshift(newIncident);

        state.aiDetectionMetrics.safetyViolations += 1;
        state.aiDetectionMetrics.criticalDetections += 1;
        state.aiDetectionMetrics.detectionsToday += 1;

        state.auditLogs.unshift({
          time: "Just now",
          action: `Incident ${incidentId} logged automatically from AI CCTV detection`,
          user: "AI Vision Agent"
        });

        return state;
      });

      this.showToast("🚨 AI Detection", "CAM-01: 'Worker #117 — No Helmet' identified with 97.4% confidence!", "danger");

      setTimeout(() => {
        this.showToast("⚠️ Alert & Scores Updated", "Active Alerts +1 | Safety Score updated to 84", "warning");
      }, 1200);

      setTimeout(() => {
        this.showToast("📋 Incident Logged", `${incidentId} recorded in Incident Management. <a href="incidents.html" style="color:#fff; text-decoration:underline; font-weight:700;">View Incidents →</a>`, "success");
      }, 2400);

    }, 800);
  },

  // Reset All Website Data to Factory Baseline
  resetAllWebsite(skipConfirm = false) {
    if (!skipConfirm) {
      const confirmed = window.confirm(
        "⚠️ RESET ENTIRE SYSTEM?\n\nThis will restore the entire SafeGuard AI platform to clean factory baseline:\n• Reset all active and historical alerts to 0\n• Reset all logged safety incidents to 0\n• Clear registered workers\n• Restore PPE detection metrics and safety score to 100%\n• Restore IoT sensors to nominal baselines\n\nClick OK to reset the entire website."
      );
      if (!confirmed) return;
    }

    // Stop active camera detector streams if running
    if (window.SafeGuardDetector) {
      try {
        if (typeof window.SafeGuardDetector.stopStream === "function") {
          window.SafeGuardDetector.stopStream();
        }
        window.SafeGuardDetector.alertsBuffer = [];
        window.SafeGuardDetector.violationsCount = 0;
        window.SafeGuardDetector.isStreaming = false;
      } catch (e) {}
    }

    // Factory reset state in localStorage & memory
    SafeGuardState.resetAll();

    this.showToast("System Reset Complete", "All website data and metrics successfully reset to factory baseline.", "success");

    setTimeout(() => {
      window.location.reload();
    }, 500);
  },

  // Reset Demo State to Defaults (alias for backward compatibility)
  resetDemoData() {
    this.resetAllWebsite(false);
  }
};

// Explicitly bind to window for cross-script access
window.SafeGuardApp = SafeGuardApp;
window.resetAllWebsite = (skipConfirm) => SafeGuardApp.resetAllWebsite(skipConfirm);

document.addEventListener("DOMContentLoaded", () => {
  SafeGuardApp.init();
});
