/**
 * SafeGuard AI — Worker Management Controller
 * Handles worker registration with face photos/webcam capture, directory listing,
 * department/risk filtering, sorting, profile modal, and deletion.
 */

let currentWorkersList = [];
let currentUploadedFace = null;
let webcamStream = null;

document.addEventListener("DOMContentLoaded", () => {
  renderWorkersTable();
  bindFilterEvents();

  // Initialize Multi-Worker Construction PPE Engine
  if (window.SafeGuardPPE) {
    SafeGuardPPE.init("ppe-detection-canvas", "ppe-detection-video");
  }

  window.addEventListener("safeguard_state_changed", () => {
    renderWorkersTable();
  });
});

function bindFilterEvents() {
  const searchInput = document.getElementById("worker-search-input");
  const riskFilter = document.getElementById("worker-risk-filter");
  const sortSelect = document.getElementById("worker-sort-select");

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (riskFilter) riskFilter.addEventListener("change", applyFilters);
  if (sortSelect) sortSelect.addEventListener("change", applyFilters);
}

function applyFilters() {
  const state = SafeGuardState.getState();
  const search = (document.getElementById("worker-search-input")?.value || "").toLowerCase().trim();
  const risk = document.getElementById("worker-risk-filter")?.value || "All";
  const sortBy = document.getElementById("worker-sort-select")?.value || "score-desc";

  const workers = state.workers || [];

  let filtered = workers.filter(w => {
    const matchesSearch = (w.name || "").toLowerCase().includes(search) || 
                          (w.id || "").toLowerCase().includes(search) || 
                          (w.department || "").toLowerCase().includes(search);
    const matchesRisk = risk === "All" || w.status === risk;
    return matchesSearch && matchesRisk;
  });

  // Sorting
  if (sortBy === "score-desc") {
    filtered.sort((a, b) => b.safetyScore - a.safetyScore);
  } else if (sortBy === "score-asc") {
    filtered.sort((a, b) => a.safetyScore - b.safetyScore);
  } else if (sortBy === "ppe-desc") {
    filtered.sort((a, b) => b.ppe - a.ppe);
  } else if (sortBy === "name-asc") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  currentWorkersList = filtered;
  renderTableRows(filtered);
}

function renderWorkersTable() {
  const state = SafeGuardState.getState();
  currentWorkersList = state.workers || [];
  const countEl = document.getElementById("sidebar-worker-count");
  if (countEl) countEl.textContent = `${currentWorkersList.length} Registered Personnel`;
  applyFilters();
}

function renderTableRows(workers) {
  const tbody = document.getElementById("workers-table-body");
  if (!tbody) return;

  if (workers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:50px 20px;">
          <div style="font-size:3rem; margin-bottom:12px;">👷</div>
          <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-bottom:6px;">No Workers Registered Yet</div>
          <div style="font-size:0.85rem; color:var(--text-secondary); max-width:440px; margin:0 auto 18px; line-height:1.5;">
            The workforce directory is currently clean. Register personnel with their name and biometric face photo to begin real-time PPE & compliance tracking.
          </div>
          <button class="btn btn-cyan btn-sm" onclick="openAddWorkerModal()" style="font-weight:700;">
            <span>👤➕</span> Register First Worker
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = workers.map(w => {
    let badgeClass = "badge-safe";
    if (w.status === "Warning") badgeClass = "badge-warning";
    if (w.status === "High Risk") badgeClass = "badge-danger";

    let scoreColor = "var(--success)";
    if (w.safetyScore < 75) scoreColor = "var(--warning)";
    if (w.safetyScore < 70) scoreColor = "var(--danger)";

    const initials = (w.name || "W")
      .split(" ")
      .filter(n => n.length > 0)
      .map(n => n[0].toUpperCase())
      .slice(0, 2)
      .join("");

    const avatarHtml = w.faceImage 
      ? `<img src="${w.faceImage}" alt="${w.name}" class="worker-avatar-thumb">`
      : `<div class="worker-avatar-fallback">${initials || "W"}</div>`;

    return `
      <tr style="cursor:pointer;" onclick="openWorkerProfile('${w.id}')">
        <td>
          <div style="display:flex; align-items:center; gap:12px;">
            ${avatarHtml}
            <div>
              <span class="mono" style="font-weight:700; color:var(--cyan); font-size:0.9rem;">${w.id}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="font-weight:700; color:var(--text-primary); font-size:0.92rem;">${w.name}</div>
          <div style="font-size:0.75rem; color:var(--text-secondary);">${w.shift || "Standard Shift"}</div>
        </td>
        <td style="color:var(--text-primary); font-size:0.85rem;">
          <div>${w.department}</div>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="width:50px; height:6px; background:var(--bg-secondary); border-radius:3px; overflow:hidden;">
              <div style="width:${w.ppe}%; height:100%; background:var(--cyan);"></div>
            </div>
            <span class="mono" style="font-weight:600; font-size:0.85rem;">${w.ppe}%</span>
          </div>
        </td>
        <td>
          <span class="mono" style="font-weight:800; font-size:1.1rem; color:${scoreColor};">${w.safetyScore}</span>
          <span style="font-size:0.75rem; color:var(--text-secondary);">/ 100</span>
        </td>
        <td><span class="badge ${badgeClass}">${w.status}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openWorkerProfile('${w.id}')">Profile</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:rgba(239,68,68,0.3); padding:4px 8px;" title="Delete Worker" onclick="event.stopPropagation(); deleteWorker('${w.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Requirement 17: Worker Profile Modal
function openWorkerProfile(workerId) {
  const state = SafeGuardState.getState();
  const worker = (state.workers || []).find(w => w.id === workerId);
  if (!worker) return;

  document.getElementById("modal-worker-name").textContent = worker.name;
  document.getElementById("modal-worker-id").textContent = worker.id;
  document.getElementById("modal-worker-dept").textContent = worker.department;
  const locEl = document.getElementById("modal-worker-location") || document.getElementById("modal-worker-zone");
  if (locEl) locEl.textContent = worker.location || "Pune Plant Floor";
  document.getElementById("modal-worker-shift").textContent = worker.shift;
  document.getElementById("modal-worker-training").textContent = worker.trainingStatus || "Certified";
  document.getElementById("modal-worker-incidents").textContent = worker.incidents || 0;
  document.getElementById("modal-worker-nearmisses").textContent = worker.nearMisses || 0;

  // Face avatar in modal header
  const avatarContainer = document.getElementById("modal-worker-avatar-container");
  if (avatarContainer) {
    if (worker.faceImage) {
      avatarContainer.innerHTML = `<img src="${worker.faceImage}" alt="${worker.name}" style="width:52px; height:52px; border-radius:50%; object-fit:cover; border:2px solid var(--cyan); box-shadow:0 0 10px rgba(34,211,238,0.3);">`;
    } else {
      const initials = (worker.name || "W").split(" ").map(n => n[0].toUpperCase()).slice(0, 2).join("");
      avatarContainer.innerHTML = `<div class="user-avatar" style="width:52px; height:52px; font-size:1.1rem;">${initials || "WP"}</div>`;
    }
  }

  // Circular gauge: Safety Compliance Score
  const circle = document.getElementById("worker-gauge-circle");
  const scoreVal = document.getElementById("worker-gauge-val");
  if (circle && scoreVal) {
    const score = worker.safetyScore || 100;
    const circumference = 377; // 2 * PI * 60
    circle.style.strokeDasharray = `${circumference}`;
    const offset = circumference - (score / 100) * circumference;
    circle.style.strokeDashoffset = `${offset}`;
    scoreVal.textContent = score;
    circle.style.stroke = score >= 90 ? "var(--success)" : (score >= 75 ? "var(--cyan)" : "var(--danger)");
  }

  // Breakdown Bars
  const bd = worker.breakdown || { helmet: 100, vest: 100, restrictedZone: 100, training: 100 };
  setBar("bar-worker-helmet", "val-worker-helmet", bd.helmet);
  setBar("bar-worker-vest", "val-worker-vest", bd.vest);
  setBar("bar-worker-zone", "val-worker-zone", bd.restrictedZone);
  setBar("bar-worker-train", "val-worker-train", bd.training);

  // Multi-Angle Biometric Photos Section
  const multiAngleSection = document.getElementById("modal-worker-multiangle-section");
  if (multiAngleSection) {
    if (worker.multiAnglePhotos && worker.multiAnglePhotos.center && worker.multiAnglePhotos.left && worker.multiAnglePhotos.right) {
      multiAngleSection.style.display = "block";
      const cImg = document.getElementById("modal-angle-center-img");
      const lImg = document.getElementById("modal-angle-left-img");
      const rImg = document.getElementById("modal-angle-right-img");
      if (cImg) cImg.src = worker.multiAnglePhotos.center;
      if (lImg) lImg.src = worker.multiAnglePhotos.left;
      if (rImg) rImg.src = worker.multiAnglePhotos.right;
    } else {
      multiAngleSection.style.display = "none";
    }
  }

  SafeGuardApp.openModal("worker-profile-modal");
}

function setBar(barId, valId, percent) {
  const bar = document.getElementById(barId);
  const val = document.getElementById(valId);
  if (bar) bar.style.width = `${percent}%`;
  if (val) val.textContent = `${percent}%`;
}

// -------------------------------------------------------------
// WORKER REGISTRATION & FACE CAPTURE CONTROLLERS
// -------------------------------------------------------------

function openAddWorkerModal() {
  const state = SafeGuardState.getState();
  const nextNumber = (state.workers || []).length + 1001;

  const idInput = document.getElementById("worker-input-id");
  const nameInput = document.getElementById("worker-input-name");
  const deptInput = document.getElementById("worker-input-dept");
  const shiftInput = document.getElementById("worker-input-shift");
  const trainInput = document.getElementById("worker-input-training");

  if (idInput) idInput.value = `W-${nextNumber}`;
  if (nameInput) {
    nameInput.value = "";
    setTimeout(() => nameInput.focus(), 200);
  }
  if (deptInput && !deptInput.value) deptInput.value = "Assembly Operations";
  if (shiftInput && !shiftInput.value) shiftInput.value = "Morning (06:00 - 14:00)";
  if (trainInput && !trainInput.value) trainInput.value = "Certified (Level 3)";

  clearFacePhoto();
  SafeGuardApp.openModal("add-worker-modal");
}

function closeAddWorkerModal() {
  stopWebcamFaceCapture();
  SafeGuardApp.closeModal("add-worker-modal");
}

function triggerFaceFileInput() {
  const input = document.getElementById("worker-face-file-input");
  if (input) input.click();
}

function handleFaceFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    // Compress and center crop onto canvas for optimal localStorage storage
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");

      const minDim = Math.min(img.width, img.height);
      const startX = (img.width - minDim) / 2;
      const startY = (img.height - minDim) / 2;

      ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 240, 240);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setFacePreview(dataUrl);
      SafeGuardApp.showToast("Face Uploaded", "Biometric photo ready for registration.", "info");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// -------------------------------------------------------------
// MULTI-ANGLE HEAD & FACE DETECTION ENROLLMENT ENGINE
// -------------------------------------------------------------

let currentMultiAnglePhotos = null;

const MultiAngleEnrollment = {
  currentStep: "center", // "center" | "left" | "right" | "complete"
  autoCapture: true,
  isDetecting: false,
  stream: null,
  videoEl: null,
  canvasEl: null,
  ctx: null,
  animId: null,
  holdStartTime: null,
  holdDurationMs: 850, // stable hold duration before auto-snap
  lastSpeechTime: 0,
  nativeDetectorInstance: null,

  capturedSnapshots: {
    center: null,
    left: null,
    right: null
  },

  stepConfig: {
    center: {
      name: "Center (Frontal)",
      icon: "🎯",
      instruction: "Step 1 of 3: Look straight at camera (Center Face)",
      pillId: "step-pill-center",
      checkId: "step-check-center",
      thumbImgId: "thumb-img-center",
      placeholderId: "placeholder-center",
      badgeId: "badge-status-center",
      audioPrompt: "Please look straight at the camera.",
      targetCheck: (yaw, asym) => Math.abs(yaw) <= 18 && asym < 0.22
    },
    left: {
      name: "Look Left",
      icon: "⬅️",
      instruction: "Step 2 of 3: Now turn your head to the LEFT",
      pillId: "step-pill-left",
      checkId: "step-check-left",
      thumbImgId: "thumb-img-left",
      placeholderId: "placeholder-left",
      badgeId: "badge-status-left",
      audioPrompt: "Center face captured. Now turn your head to the left.",
      targetCheck: (yaw, asym) => yaw <= -20 || (yaw <= -12 && asym > 0.20)
    },
    right: {
      name: "Look Right",
      icon: "➡️",
      instruction: "Step 3 of 3: Now turn your head to the RIGHT",
      pillId: "step-pill-right",
      checkId: "step-check-right",
      thumbImgId: "thumb-img-right",
      placeholderId: "placeholder-right",
      badgeId: "badge-status-right",
      audioPrompt: "Left profile captured. Now turn your head to the right.",
      targetCheck: (yaw, asym) => yaw >= 20 || (yaw >= 12 && asym > 0.20)
    }
  },

  init() {
    this.videoEl = document.getElementById("webcam-face-video");
    this.canvasEl = document.getElementById("webcam-face-canvas");
    if (this.canvasEl) this.ctx = this.canvasEl.getContext("2d");

    if ("FaceDetector" in window) {
      try {
        this.nativeDetectorInstance = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 1 });
      } catch (e) {
        this.nativeDetectorInstance = null;
      }
    }
  },

  startCamera() {
    const panel = document.getElementById("webcam-capture-panel");
    this.init();
    if (!panel || !this.videoEl) return;

    panel.style.display = "block";
    this.resetSequence();

    navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 480 }, height: { ideal: 360 }, facingMode: "user" } 
    })
      .then(stream => {
        this.stream = stream;
        webcamStream = stream;
        this.videoEl.srcObject = stream;
        this.videoEl.play();
        this.isDetecting = true;
        this.speakGuidance(this.stepConfig.center.audioPrompt);
        this.updateStepUI();
        this.loop();
      })
      .catch(err => {
        SafeGuardApp.showToast("Camera Error", "Could not access webcam: " + err.message, "danger");
        panel.style.display = "none";
      });
  },

  stopCamera() {
    this.isDetecting = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
      webcamStream = null;
    }
    if (this.videoEl) this.videoEl.srcObject = null;
    const panel = document.getElementById("webcam-capture-panel");
    if (panel) panel.style.display = "none";
  },

  selectStep(stepKey) {
    if (this.stepConfig[stepKey]) {
      this.currentStep = stepKey;
      this.holdStartTime = null;
      this.updateStepUI();
      this.speakGuidance(this.stepConfig[stepKey].instruction);
    }
  },

  resetSequence() {
    this.currentStep = "center";
    this.holdStartTime = null;
    this.capturedSnapshots = { center: null, left: null, right: null };

    ["center", "left", "right"].forEach(key => {
      const cfg = this.stepConfig[key];
      const img = document.getElementById(cfg.thumbImgId);
      const ph = document.getElementById(cfg.placeholderId);
      const badge = document.getElementById(cfg.badgeId);
      const check = document.getElementById(cfg.checkId);
      const pill = document.getElementById(cfg.pillId);

      if (img) { img.src = ""; img.style.display = "none"; }
      if (ph) ph.style.display = "flex";
      if (badge) { badge.textContent = "Pending"; badge.className = "badge badge-outline"; }
      if (check) check.style.display = "none";
      if (pill) pill.className = "multi-angle-step-pill";
    });

    const applyBtnCont = document.getElementById("btn-apply-multiangle-container");
    if (applyBtnCont) applyBtnCont.style.display = "none";

    this.updateStepUI();
  },

  updateStepUI() {
    if (this.currentStep === "complete") {
      const banner = document.getElementById("multi-angle-banner");
      const icon = document.getElementById("banner-icon");
      const text = document.getElementById("banner-text");
      if (icon) icon.textContent = "✅";
      if (text) text.textContent = "All 3 Head Angles Enrolled! (Center, Left, Right)";
      if (banner) {
        banner.style.borderColor = "var(--success)";
        banner.style.background = "rgba(34, 197, 94, 0.12)";
      }
      const applyBtnCont = document.getElementById("btn-apply-multiangle-container");
      if (applyBtnCont) applyBtnCont.style.display = "block";
      return;
    }

    const cfg = this.stepConfig[this.currentStep];
    if (!cfg) return;

    // Update banner
    const banner = document.getElementById("multi-angle-banner");
    const icon = document.getElementById("banner-icon");
    const text = document.getElementById("banner-text");
    if (icon) icon.textContent = cfg.icon;
    if (text) text.textContent = cfg.instruction;
    if (banner) {
      banner.style.borderColor = "var(--border)";
      banner.style.background = "var(--bg-primary)";
    }

    // Update pills
    ["center", "left", "right"].forEach(key => {
      const pill = document.getElementById(this.stepConfig[key].pillId);
      if (!pill) return;
      if (this.capturedSnapshots[key]) {
        pill.className = "multi-angle-step-pill completed";
      } else if (key === this.currentStep) {
        pill.className = "multi-angle-step-pill active";
      } else {
        pill.className = "multi-angle-step-pill";
      }
    });

    // Update snap button
    const snapBtn = document.getElementById("btn-snap-current-angle");
    if (snapBtn) {
      snapBtn.innerHTML = `📸 Snap ${cfg.name}`;
    }
  },

  async loop() {
    if (!this.isDetecting) return;

    const video = this.videoEl;
    const canvas = this.canvasEl;
    const ctx = this.ctx;

    if (video && video.readyState >= 2 && canvas && ctx) {
      const vw = video.videoWidth || 320;
      const vh = video.videoHeight || 240;
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
      }

      ctx.clearRect(0, 0, vw, vh);

      let detectedFace = null;
      let yaw = 0;
      let asymmetry = 0;
      let isAligned = false;

      // 1. Try Native FaceDetector API
      if (this.nativeDetectorInstance) {
        try {
          const faces = await this.nativeDetectorInstance.detect(video);
          if (faces && faces.length > 0) {
            const f = faces[0];
            const bb = f.boundingBox;
            detectedFace = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
            const lms = f.landmarks || [];
            const leftEye = lms.find(l => l.type === "eye" && l.location.x < bb.x + bb.width / 2);
            const rightEye = lms.find(l => l.type === "eye" && l.location.x >= bb.x + bb.width / 2);
            const nose = lms.find(l => l.type === "nose");

            if (leftEye && rightEye && nose) {
              const eyeDist = Math.max(10, Math.abs(rightEye.location.x - leftEye.location.x));
              const eyeMidX = (leftEye.location.x + rightEye.location.x) / 2;
              const noseOffset = (nose.location.x - eyeMidX) / eyeDist;
              // Mirror calibration
              yaw = Math.round(-noseOffset * 90);
            } else if (leftEye && !rightEye) {
              yaw = -65;
            } else if (rightEye && !leftEye) {
              yaw = 65;
            }
          }
        } catch (e) {}
      }

      // 2. Fallback: Spatial Luminance & Skin Symmetry CV Analysis
      if (!detectedFace) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = 160;
        tempCanvas.height = 120;
        const tctx = tempCanvas.getContext("2d");
        tctx.drawImage(video, 0, 0, 160, 120);
        const imgData = tctx.getImageData(30, 20, 100, 80);
        const data = imgData.data;

        let leftSum = 0, rightSum = 0, leftCount = 0, rightCount = 0;
        for (let y = 0; y < 80; y++) {
          for (let x = 0; x < 100; x++) {
            const idx = (y * 100 + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            if (r > 60 && g > 40 && b > 20 && r > b) {
              const luma = 0.299 * r + 0.587 * g + 0.114 * b;
              if (x < 50) { leftSum += luma; leftCount++; }
              else { rightSum += luma; rightCount++; }
            }
          }
        }

        const avgL = leftCount > 0 ? leftSum / leftCount : 0;
        const avgR = rightCount > 0 ? rightSum / rightCount : 0;
        const totalAvg = (avgL + avgR) / 2 || 1;
        asymmetry = Math.abs(avgL - avgR) / totalAvg;

        if (avgL > avgR + 15) {
          yaw = Math.round(-asymmetry * 90);
        } else if (avgR > avgL + 15) {
          yaw = Math.round(asymmetry * 90);
        } else {
          yaw = 0;
        }

        detectedFace = { x: vw * 0.25, y: vh * 0.15, w: vw * 0.5, h: vh * 0.7 };
      }

      // 3. Evaluate alignment with current target step
      if (this.currentStep !== "complete" && this.stepConfig[this.currentStep]) {
        isAligned = this.stepConfig[this.currentStep].targetCheck(yaw, asymmetry);
      }

      // Update HUD reticle and chips
      const reticle = document.getElementById("webcam-face-reticle");
      if (reticle) {
        if (isAligned) {
          reticle.classList.add("aligned");
        } else {
          reticle.classList.remove("aligned");
        }
      }

      const hudBadge = document.getElementById("webcam-hud-badge");
      const hudAngle = document.getElementById("webcam-hud-angle");
      if (hudAngle) hudAngle.textContent = `Yaw: ${yaw > 0 ? '+' : ''}${yaw}°`;

      if (hudBadge) {
        if (isAligned) {
          hudBadge.textContent = `✓ ${this.stepConfig[this.currentStep].name} Aligned!`;
          hudBadge.className = "badge badge-safe";
        } else if (Math.abs(yaw) <= 18) {
          hudBadge.textContent = "Facing Center";
          hudBadge.className = "badge badge-cyan";
        } else if (yaw < -18) {
          hudBadge.textContent = "Looking Left";
          hudBadge.className = "badge badge-orange";
        } else {
          hudBadge.textContent = "Looking Right";
          hudBadge.className = "badge badge-orange";
        }
      }

      // Draw Visual Direction Guides on Canvas
      this.drawCanvasGuides(ctx, vw, vh, detectedFace, yaw, isAligned);

      // 4. Handle Hold Progress Bar & Auto-Snap
      const holdContainer = document.getElementById("webcam-hold-container");
      const holdFill = document.getElementById("webcam-hold-fill");

      if (isAligned && this.currentStep !== "complete") {
        if (!this.holdStartTime) this.holdStartTime = performance.now();
        const elapsed = performance.now() - this.holdStartTime;
        const pct = Math.min(100, Math.round((elapsed / this.holdDurationMs) * 100));

        if (holdContainer) holdContainer.style.display = "block";
        if (holdFill) holdFill.style.width = `${pct}%`;

        if (pct >= 100 && this.autoCapture) {
          this.holdStartTime = null;
          this.snapCurrentAngle(false);
        }
      } else {
        this.holdStartTime = null;
        if (holdContainer) holdContainer.style.display = "none";
        if (holdFill) holdFill.style.width = "0%";
      }
    }

    this.animId = requestAnimationFrame(() => this.loop());
  },

  drawCanvasGuides(ctx, w, h, box, yaw, isAligned) {
    if (!box) return;
    const cy = box.y + box.h / 2;

    ctx.save();
    if (this.currentStep === "left" && !isAligned) {
      // Draw animated arrow pointing to Left
      ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
      ctx.beginPath();
      ctx.moveTo(35, cy);
      ctx.lineTo(60, cy - 18);
      ctx.lineTo(60, cy - 7);
      ctx.lineTo(95, cy - 7);
      ctx.lineTo(95, cy + 7);
      ctx.lineTo(60, cy + 7);
      ctx.lineTo(60, cy + 18);
      ctx.closePath();
      ctx.fill();

      ctx.font = "bold 13px sans-serif";
      ctx.fillText("TURN LEFT ⬅️", 30, cy + 35);
    } else if (this.currentStep === "right" && !isAligned) {
      // Draw animated arrow pointing to Right
      ctx.fillStyle = "rgba(249, 115, 22, 0.85)";
      ctx.beginPath();
      ctx.moveTo(w - 35, cy);
      ctx.lineTo(w - 60, cy - 18);
      ctx.lineTo(w - 60, cy - 7);
      ctx.lineTo(w - 95, cy - 7);
      ctx.lineTo(w - 95, cy + 7);
      ctx.lineTo(w - 60, cy + 7);
      ctx.lineTo(w - 60, cy + 18);
      ctx.closePath();
      ctx.fill();

      ctx.font = "bold 13px sans-serif";
      ctx.fillText("TURN RIGHT ➡️", w - 120, cy + 35);
    } else if (this.currentStep === "center" && !isAligned) {
      // Center crosshair
      ctx.strokeStyle = "rgba(249, 115, 22, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(box.x + box.w / 2, cy, 25, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isAligned) {
      // Aligned green halo
      ctx.strokeStyle = "#22C55E";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(box.x + box.w / 2, cy, 32, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  snapCurrentAngle(isManual = false) {
    if (this.currentStep === "complete") return;

    const video = this.videoEl;
    if (!video) return;

    // Flash animation on viewport
    const vp = document.getElementById("webcam-viewport-box");
    if (vp) {
      vp.classList.remove("shutter-flash");
      void vp.offsetWidth; // trigger reflow
      vp.classList.add("shutter-flash");
    }

    // Capture cropped square
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = 240;
    cropCanvas.height = 240;
    const cropCtx = cropCanvas.getContext("2d");

    const vw = video.videoWidth || 320;
    const vh = video.videoHeight || 240;
    const minDim = Math.min(vw, vh);
    const startX = (vw - minDim) / 2;
    const startY = (vh - minDim) / 2;

    // Mirror horizontal to match natural preview
    cropCtx.translate(cropCanvas.width, 0);
    cropCtx.scale(-1, 1);
    cropCtx.drawImage(video, startX, startY, minDim, minDim, 0, 0, 240, 240);

    const dataUrl = cropCanvas.toDataURL("image/jpeg", 0.90);
    const stepKey = this.currentStep;
    this.capturedSnapshots[stepKey] = dataUrl;

    // Update thumbnail in 3-angle strip
    const cfg = this.stepConfig[stepKey];
    const thumbImg = document.getElementById(cfg.thumbImgId);
    const ph = document.getElementById(cfg.placeholderId);
    const badge = document.getElementById(cfg.badgeId);
    const check = document.getElementById(cfg.checkId);
    const pill = document.getElementById(cfg.pillId);

    if (thumbImg) {
      thumbImg.src = dataUrl;
      thumbImg.style.display = "block";
    }
    if (ph) ph.style.display = "none";
    if (badge) {
      badge.textContent = "✓ Captured";
      badge.className = "badge badge-safe";
    }
    if (check) check.style.display = "inline";
    if (pill) pill.className = "multi-angle-step-pill completed";

    // Advance step
    if (stepKey === "center") {
      this.currentStep = "left";
      this.speakGuidance(this.stepConfig.left.audioPrompt);
      SafeGuardApp.showToast("Center Captured", "Step 1 complete! Now turn head to the left.", "info");
      this.updateStepUI();
    } else if (stepKey === "left") {
      this.currentStep = "right";
      this.speakGuidance(this.stepConfig.right.audioPrompt);
      SafeGuardApp.showToast("Left Profile Captured", "Step 2 complete! Now turn head to the right.", "info");
      this.updateStepUI();
    } else if (stepKey === "right") {
      this.currentStep = "complete";
      this.speakGuidance("Right profile captured! All head angles successfully registered.");
      SafeGuardApp.showToast("Multi-Angle Enrolled", "All 3 head angles successfully registered!", "success");
      this.updateStepUI();
      // Auto-finish after brief pause
      setTimeout(() => this.finishEnrollment(), 700);
    }
  },

  finishEnrollment() {
    if (!this.capturedSnapshots.center) {
      SafeGuardApp.showToast("Incomplete", "Please capture at least the Center face angle.", "warning");
      return;
    }

    // Synthesize 3-in-1 composite image
    const compCanvas = document.createElement("canvas");
    compCanvas.width = 450;
    compCanvas.height = 150;
    const cctx = compCanvas.getContext("2d");

    // Dark industrial background
    cctx.fillStyle = "#111827";
    cctx.fillRect(0, 0, 450, 150);

    const keys = ["center", "left", "right"];
    const labels = ["CENTER (FRONT)", "LEFT PROFILE", "RIGHT PROFILE"];

    let loadedCount = 0;
    keys.forEach((key, idx) => {
      const snap = this.capturedSnapshots[key] || this.capturedSnapshots.center;
      const img = new Image();
      img.onload = () => {
        cctx.drawImage(img, idx * 150, 0, 150, 150);
        // Header bar on slice
        cctx.fillStyle = "rgba(11, 15, 20, 0.75)";
        cctx.fillRect(idx * 150, 126, 150, 24);
        cctx.font = "bold 9px monospace";
        cctx.fillStyle = idx === 0 ? "#22C55E" : (idx === 1 ? "#38BDF8" : "#F97316");
        cctx.textAlign = "center";
        cctx.fillText(labels[idx], idx * 150 + 75, 142);

        // Divider
        if (idx > 0) {
          cctx.strokeStyle = "#303B49";
          cctx.lineWidth = 1;
          cctx.beginPath();
          cctx.moveTo(idx * 150, 0);
          cctx.lineTo(idx * 150, 150);
          cctx.stroke();
        }

        loadedCount++;
        if (loadedCount === 3) {
          const compDataUrl = compCanvas.toDataURL("image/jpeg", 0.90);
          currentMultiAnglePhotos = {
            center: this.capturedSnapshots.center,
            left: this.capturedSnapshots.left || this.capturedSnapshots.center,
            right: this.capturedSnapshots.right || this.capturedSnapshots.center,
            composite: compDataUrl
          };

          // Primary face preview is high-res center
          setFacePreview(this.capturedSnapshots.center);
          this.stopCamera();
        }
      };
      img.src = snap;
    });
  },

  speakGuidance(text) {
    if (!("speechSynthesis" in window)) return;
    const now = performance.now();
    if (now - this.lastSpeechTime < 2500) return;
    this.lastSpeechTime = now;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
};

function toggleWebcamFaceCapture() {
  const panel = document.getElementById("webcam-capture-panel");
  if (!panel) return;
  if (panel.style.display === "none") {
    MultiAngleEnrollment.startCamera();
  } else {
    MultiAngleEnrollment.stopCamera();
  }
}

function stopWebcamFaceCapture() {
  MultiAngleEnrollment.stopCamera();
}

function captureWebcamSnapshot() {
  MultiAngleEnrollment.snapCurrentAngle(true);
}

function selectAvatarPreset(emoji) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 160, 160);
  gradient.addColorStop(0, "#0c233f");
  gradient.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 160, 160);

  ctx.font = "80px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 80, 85);

  const dataUrl = canvas.toDataURL("image/png");
  currentMultiAnglePhotos = null;
  setFacePreview(dataUrl);
  SafeGuardApp.showToast("Avatar Selected", `Safety avatar ${emoji} chosen.`, "info");
}

function setFacePreview(dataUrl) {
  currentUploadedFace = dataUrl;
  const img = document.getElementById("face-preview-img");
  const placeholder = document.getElementById("face-preview-placeholder");
  const clearBtn = document.getElementById("btn-clear-face");
  const previewBox = document.getElementById("new-worker-face-preview");

  if (img && placeholder) {
    img.src = dataUrl;
    img.style.display = "block";
    placeholder.style.display = "none";
  }
  if (clearBtn) clearBtn.style.display = "inline-flex";

  // If 3 angles enrolled, show a verification badge in preview box
  if (previewBox) {
    let enrolledBadge = previewBox.querySelector(".multiangle-enrolled-badge");
    if (currentMultiAnglePhotos && currentMultiAnglePhotos.center && currentMultiAnglePhotos.left && currentMultiAnglePhotos.right) {
      if (!enrolledBadge) {
        enrolledBadge = document.createElement("span");
        enrolledBadge.className = "badge badge-safe multiangle-enrolled-badge";
        enrolledBadge.style.cssText = "position:absolute; bottom:6px; left:50%; transform:translateX(-50%); font-size:0.65rem; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.6); pointer-events:none; z-index:4;";
        enrolledBadge.textContent = "✓ 3 Angles Enrolled";
        previewBox.style.position = "relative";
        previewBox.appendChild(enrolledBadge);
      }
    } else if (enrolledBadge) {
      enrolledBadge.remove();
    }
  }
}

function clearFacePhoto() {
  currentUploadedFace = null;
  currentMultiAnglePhotos = null;
  const img = document.getElementById("face-preview-img");
  const placeholder = document.getElementById("face-preview-placeholder");
  const clearBtn = document.getElementById("btn-clear-face");
  const fileInput = document.getElementById("worker-face-file-input");
  const previewBox = document.getElementById("new-worker-face-preview");

  if (img && placeholder) {
    img.src = "";
    img.style.display = "none";
    placeholder.style.display = "flex";
  }
  if (fileInput) fileInput.value = "";
  if (clearBtn) clearBtn.style.display = "none";
  if (previewBox) {
    const b = previewBox.querySelector(".multiangle-enrolled-badge");
    if (b) b.remove();
  }
  MultiAngleEnrollment.resetSequence();
}

// -------------------------------------------------------------
// BIOMETRIC FACE ENROLLMENT SIGNATURE EXTRACTION
// -------------------------------------------------------------

function computeBiometricSignatureFromImageData(imgData) {
  const data = imgData.data;
  const w = imgData.width;
  const h = imgData.height;
  const totalPixels = w * h;
  if (totalPixels === 0) return null;

  // 1. Grayscale luminance extraction
  const gray = new Float32Array(totalPixels);
  let sumGray = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const g = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    gray[i] = g;
    sumGray += g;
  }

  // 2. Global mean subtraction & variance normalization (lighting invariance)
  const meanGray = sumGray / totalPixels;
  let varSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    const diff = gray[i] - meanGray;
    varSum += diff * diff;
  }
  const variance = varSum / totalPixels;
  const stdGray = Math.sqrt(variance) + 1e-4;
  if (stdGray < 5.0) {
    return null; // Image is blank or lacks sufficient contrast
  }

  for (let i = 0; i < totalPixels; i++) {
    gray[i] = (gray[i] - meanGray) / stdGray;
  }

  // 3. 8x8 Spatial Grid cells with Local Binary Patterns (LBP) and directional gradients
  const gridSize = 8;
  const cellW = Math.max(1, Math.floor(w / gridSize));
  const cellH = Math.max(1, Math.floor(h / gridSize));
  const vector = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * cellW;
      const startY = gy * cellH;
      const endX = Math.min(w, startX + cellW);
      const endY = Math.min(h, startY + cellH);

      const lbpBins = [0, 0, 0, 0, 0, 0, 0, 0];
      let gradSumX = 0;
      let gradSumY = 0;
      let lbpCount = 0;

      for (let y = startY + 1; y < endY - 1; y++) {
        for (let x = startX + 1; x < endX - 1; x++) {
          const centerVal = gray[y * w + x];

          let pattern = 0;
          if (gray[(y - 1) * w + (x - 1)] >= centerVal) pattern |= 1;
          if (gray[(y - 1) * w + x] >= centerVal) pattern |= 2;
          if (gray[(y - 1) * w + (x + 1)] >= centerVal) pattern |= 4;
          if (gray[y * w + (x + 1)] >= centerVal) pattern |= 8;
          if (gray[(y + 1) * w + (x + 1)] >= centerVal) pattern |= 16;
          if (gray[(y + 1) * w + x] >= centerVal) pattern |= 32;
          if (gray[(y + 1) * w + (x - 1)] >= centerVal) pattern |= 64;
          if (gray[y * w + (x - 1)] >= centerVal) pattern |= 128;

          const bin = Math.floor(pattern / 32);
          lbpBins[Math.min(7, bin)]++;

          const gxVal = Math.abs(gray[y * w + (x + 1)] - gray[y * w + (x - 1)]);
          const gyVal = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
          gradSumX += gxVal;
          gradSumY += gyVal;
          lbpCount++;
        }
      }

      if (lbpCount > 0) {
        for (let b = 0; b < 8; b++) {
          vector.push(lbpBins[b] / lbpCount);
        }
        vector.push(gradSumX / lbpCount);
        vector.push(gradSumY / lbpCount);
      } else {
        for (let b = 0; b < 8; b++) vector.push(0.125);
        vector.push(0, 0);
      }
    }
  }

  // 4. L2 Normalization of entire feature vector
  let normSq = 0;
  for (let i = 0; i < vector.length; i++) {
    normSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(normSq) + 1e-6;
  for (let i = 0; i < vector.length; i++) {
    vector[i] /= norm;
  }

  return vector;
}

function loadAndExtractSignatures(url) {
  return new Promise((resolve) => {
    if (!url) return resolve([]);
    const img = new Image();
    img.crossOrigin = "anonymous";
    let finished = false;

    const processImage = () => {
      if (finished) return;
      finished = true;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 64, 64);
        const imgData = ctx.getImageData(0, 0, 64, 64);
        const sig = computeBiometricSignatureFromImageData(imgData);

        const sigs = [];
        if (sig) sigs.push(sig);

        // Also extract horizontally mirrored template for mirror-invariant recognition
        ctx.clearRect(0, 0, 64, 64);
        ctx.save();
        ctx.translate(64, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, 64, 64);
        ctx.restore();
        const flipData = ctx.getImageData(0, 0, 64, 64);
        const sigFlip = computeBiometricSignatureFromImageData(flipData);
        if (sigFlip) sigs.push(sigFlip);

        resolve(sigs);
      } catch (e) {
        resolve([]);
      }
    };

    img.onload = processImage;
    img.onerror = () => { finished = true; resolve([]); };
    img.src = url;
    if (img.complete && img.naturalWidth > 0) {
      processImage();
    }
  });
}

async function loadAndExtractSignature(url) {
  const sigs = await loadAndExtractSignatures(url);
  return sigs.length > 0 ? sigs[0] : null;
}

window.SafeGuardBiometrics = {
  computeBiometricSignatureFromImageData,
  loadAndExtractSignature,
  loadAndExtractSignatures
};

async function handleSaveWorker(event) {
  event.preventDefault();

  const name = document.getElementById("worker-input-name").value.trim();
  const id = document.getElementById("worker-input-id").value.trim() || `W-${Date.now().toString().slice(-4)}`;
  const department = document.getElementById("worker-input-dept").value.trim() || "Assembly Operations";
  const shift = document.getElementById("worker-input-shift").value.trim() || "Morning (06:00 - 14:00)";
  const trainingStatus = document.getElementById("worker-input-training").value.trim() || "Certified (Level 3)";

  if (!name) {
    SafeGuardApp.showToast("Validation Error", "Worker name is required.", "danger");
    return;
  }
  if (!id) {
    SafeGuardApp.showToast("Validation Error", "Worker ID is required.", "danger");
    return;
  }

  // Precompute Biometric Face Signatures for immediate, synchronous live camera recognition
  const photoUrls = [];
  if (currentUploadedFace) photoUrls.push(currentUploadedFace);
  if (currentMultiAnglePhotos) {
    if (currentMultiAnglePhotos.center && !photoUrls.includes(currentMultiAnglePhotos.center)) photoUrls.push(currentMultiAnglePhotos.center);
    if (currentMultiAnglePhotos.left && !photoUrls.includes(currentMultiAnglePhotos.left)) photoUrls.push(currentMultiAnglePhotos.left);
    if (currentMultiAnglePhotos.right && !photoUrls.includes(currentMultiAnglePhotos.right)) photoUrls.push(currentMultiAnglePhotos.right);
  }

  if (photoUrls.length === 0) {
    SafeGuardApp.showToast("Face Photo Required", "Please upload or capture a biometric face photograph to register this worker for AI safety identification.", "warning");
    return;
  }

  const faceSignatures = [];
  for (const url of photoUrls) {
    const sigs = await loadAndExtractSignatures(url);
    if (sigs && sigs.length > 0) {
      faceSignatures.push(...sigs);
    }
  }

  if (faceSignatures.length === 0) {
    SafeGuardApp.showToast("Biometric Extraction Failed", "Photo lacks sufficient facial contrast or appears blank. Please provide a clear face photograph.", "danger");
    return;
  }

  const primaryPhoto = currentUploadedFace || (currentMultiAnglePhotos ? currentMultiAnglePhotos.center : null);
  const backendUrl = (typeof SafeGuardApp !== "undefined" && SafeGuardApp.getBackendUrl)
    ? SafeGuardApp.getBackendUrl()
    : (localStorage.getItem("safeguard_backend_url") || "http://127.0.0.1:8000");

  const reqPayload = {
    id: id,
    worker_id: id,
    name: name,
    worker_name: name,
    department: department,
    shift: shift,
    trainingStatus: trainingStatus,
    role: trainingStatus,
    location: "Pune Plant Floor",
    faceImage: primaryPhoto,
    face_image: primaryPhoto,
    multiAnglePhotos: currentMultiAnglePhotos || null,
    multi_angle_photos: currentMultiAnglePhotos || null,
    faceSignatures: faceSignatures,
    face_signatures: faceSignatures,
    face_embedding: faceSignatures[0] || null,
    overwrite: false
  };

  // Attempt verified backend database enrollment first
  let backendEnrolled = false;
  try {
    const res = await fetch(`${backendUrl}/api/workers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqPayload),
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const detail = errData.detail || errData.message || `Server returned HTTP ${res.status}`;
      SafeGuardApp.showToast("Registration Rejected", detail, "danger");
      return; // Stop enrollment on server validation failure or duplicate ID!
    }
    backendEnrolled = true;
  } catch (netErr) {
    console.warn("Backend offline during worker registration, saving to reactive local store:", netErr.message);
  }

  const newWorker = {
    id: id,
    worker_id: id,
    name: name,
    worker_name: name,
    department: department,
    location: "Pune Plant Floor",
    shift: shift,
    ppe: 100,
    safetyScore: 100,
    status: "Safe",
    incidents: 0,
    nearMisses: 0,
    trainingStatus: trainingStatus,
    faceImage: primaryPhoto,
    multiAnglePhotos: currentMultiAnglePhotos || null,
    faceSignatures: faceSignatures,
    breakdown: { helmet: 100, vest: 100, restrictedZone: 100, training: 100 }
  };

  SafeGuardState.update(state => {
    state.workers = state.workers || [];
    const existingIndex = state.workers.findIndex(w => w.id === newWorker.id);
    if (existingIndex >= 0) {
      state.workers[existingIndex] = newWorker;
    } else {
      state.workers.unshift(newWorker);
    }
    state.kpis.activeWorkers = state.workers.length;
    state.auditLogs.unshift({
      time: "Just now",
      action: `Worker registered: ${newWorker.name} (${newWorker.id}) [${newWorker.department} / ${newWorker.shift}]` +
              (backendEnrolled ? " (Backend DB Verified)" : " (Local Store)"),
      user: state.user.name
    });
    return state;
  });

  closeAddWorkerModal();

  if (window.LiveCameraDetector && typeof window.LiveCameraDetector.invalidateFaceCache === "function") {
    window.LiveCameraDetector.invalidateFaceCache();
  }
  if (window.SafeGuardDetector && typeof window.SafeGuardDetector.invalidateFaceCache === "function") {
    window.SafeGuardDetector.invalidateFaceCache();
  }
  if (window.SafeGuardPPE && typeof window.SafeGuardPPE.invalidateFaceCache === "function") {
    window.SafeGuardPPE.invalidateFaceCache();
  }
  if (window.MultiWorkerPPEDetector && typeof window.MultiWorkerPPEDetector.invalidateFaceCache === "function") {
    window.MultiWorkerPPEDetector.invalidateFaceCache();
  }

  // Broadcast state change across tabs/windows
  window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: { workerId: newWorker.id } }));

  const successMsg = backendEnrolled
    ? `${name} (${id}) registered with verified biometric database template.`
    : `${name} (${id}) saved to local safety tracking directory.`;
  SafeGuardApp.showToast("Worker Registered", successMsg, "success");
  renderWorkersTable();
}

function deleteWorker(workerId) {
  const state = SafeGuardState.getState();
  const worker = (state.workers || []).find(w => (w.id === workerId || w.worker_id === workerId));
  const workerName = worker ? worker.name : workerId;

  if (!confirm(`Are you sure you want to remove ${workerName} (${workerId}) from the safety directory?`)) {
    return;
  }

  SafeGuardState.update(s => {
    s.workers = (s.workers || []).filter(w => (w.id !== workerId && w.worker_id !== workerId));
    s.kpis.activeWorkers = s.workers.length;
    s.auditLogs.unshift({
      time: "Just now",
      action: `Worker removed: ${workerName} (${workerId})`,
      user: s.user.name
    });
    return s;
  });

  // Sync deletion with backend if available
  const backendUrl = (typeof SafeGuardApp !== "undefined" && SafeGuardApp.getBackendUrl)
    ? SafeGuardApp.getBackendUrl()
    : (localStorage.getItem("safeguard_backend_url") || "http://127.0.0.1:8000");

  try {
    fetch(`${backendUrl}/api/workers/${encodeURIComponent(workerId)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(3000)
    }).catch(() => {});
  } catch (e) {}

  if (window.LiveCameraDetector && typeof window.LiveCameraDetector.invalidateFaceCache === "function") {
    window.LiveCameraDetector.invalidateFaceCache();
  }
  if (window.SafeGuardDetector && typeof window.SafeGuardDetector.invalidateFaceCache === "function") {
    window.SafeGuardDetector.invalidateFaceCache();
  }
  if (window.SafeGuardPPE && typeof window.SafeGuardPPE.invalidateFaceCache === "function") {
    window.SafeGuardPPE.invalidateFaceCache();
  }
  if (window.MultiWorkerPPEDetector && typeof window.MultiWorkerPPEDetector.invalidateFaceCache === "function") {
    window.MultiWorkerPPEDetector.invalidateFaceCache();
  }

  window.dispatchEvent(new CustomEvent("safeguard_state_changed", { detail: { deletedId: workerId } }));

  SafeGuardApp.showToast("Worker Removed", `${workerName} has been deleted from active registry.`, "info");
  renderWorkersTable();
}

/**
 * API Backend Configuration Modal Helpers
 */
function openApiConfigModal() {
  const input = document.getElementById("api-backend-url-input");
  if (input && window.SafeGuardPPE) {
    input.value = SafeGuardPPE.backendUrl;
  }
  const modal = document.getElementById("api-config-modal");
  if (modal) modal.classList.add("active");
}

function closeApiConfigModal() {
  const modal = document.getElementById("api-config-modal");
  if (modal) modal.classList.remove("active");
  const res = document.getElementById("api-test-result");
  if (res) res.textContent = "";
}

async function testBackendConnection() {
  const input = document.getElementById("api-backend-url-input");
  const resEl = document.getElementById("api-test-result");
  if (!input || !resEl) return;
  resEl.textContent = "Connecting...";
  resEl.style.color = "var(--cyan)";

  try {
    let url = input.value.trim();
    if (url.endsWith("/")) url = url.slice(0, -1);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      resEl.textContent = `✓ Online (${data.engine})`;
      resEl.style.color = "var(--success)";
    } else {
      resEl.textContent = "❌ Failed: Invalid response";
      resEl.style.color = "var(--danger)";
    }
  } catch (e) {
    resEl.textContent = "❌ Failed: Unreachable";
    resEl.style.color = "var(--danger)";
  }
}

function saveApiBackendUrl() {
  const input = document.getElementById("api-backend-url-input");
  if (input && window.SafeGuardPPE) {
    SafeGuardPPE.setBackendUrl(input.value);
    SafeGuardApp.showToast("Backend URL Saved", `Targeting ${SafeGuardPPE.backendUrl}`, "success");
  }
  closeApiConfigModal();
}

function toggleReportDropdown() {
  const menu = document.getElementById("report-dropdown-menu");
  if (menu) {
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  }
}

// Close report dropdown when clicked outside
document.addEventListener("click", (e) => {
  const menu = document.getElementById("report-dropdown-menu");
  if (menu && !e.target.closest(".dropdown")) {
    menu.style.display = "none";
  }
});

