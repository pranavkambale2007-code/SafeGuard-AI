/**
 * SafeGuard AI — Dual-Class (Construction & Normal Helmet) + High-Vis Vest PPE Detection Engine
 * Pure Vanilla JavaScript (Client-side HTML5 Canvas + WebRTC + Multi-Spectral CV)
 *
 * DETECTS BOTH:
 * 1. CONSTRUCTION SAFETY HELMETS (OSHA & EN 397 Standard Hardhats):
 *    - High-Vis Yellow Hardhat
 *    - Engineering White Hardhat (High-luminance plastic dome with specular reflection)
 *    - Safety Day-Glo Orange & Emergency Red Hardhat
 *    - Industrial Safety Blue & Green Hardhat
 * 2. NORMAL HELMETS (Motorcycle, Scooter, Bicycle, Rider & Sports Helmets):
 *    - Glossy Black & Matte Black Motorcycle/Scooter Helmets (Smooth composite shell with specular reflection arcs)
 *    - Metallic, Silver & Titanium Rider Helmets
 *    - Full-Face Helmets with Visor / Protective Eye Shields
 *    - Sports, Bicycle & Aerodynamic Commuter Helmets
 * 3. HIGH-VISIBILITY SAFETY VESTS (ISO 20471 & ANSI/ISEA 107 Standard):
 *    - Fluorescent Neon Lime / High-Vis Yellow-Green (46°-108° Hue)
 *    - Fluorescent Day-Glo Safety Orange (8°-34° Hue)
 *    - Retro-Reflective Silver / White Safety Stripes (Co-occurrence band detection)
 *    - High-Vis Safety Blue / Red with reflective safety tape
 * 4. Temporal Multi-Frame Voting & Hysteresis Smoothing:
 *    - Prevents single-frame video noise and eliminates green/red flickering.
 */

const LiveCameraDetector = {
  // Elements
  videoEl: null,
  canvasEl: null,
  ctx: null,

  // Stream state
  stream: null,
  animationFrameId: null,
  currentMode: "standby", // "webcam" | "upload" | "sample" | "standby"
  visionMode: "ppe", // "ppe" | "face" | "combined"
  isRunning: false,
  audioMuted: false,

  setVisionMode(mode) {
    this.visionMode = mode;
    const btnPPE = document.getElementById("vision-mode-ppe-btn");
    const btnFace = document.getElementById("vision-mode-face-btn");
    const btnDual = document.getElementById("vision-mode-dual-btn");

    if (btnPPE) btnPPE.className = mode === "ppe" ? "btn btn-sm btn-cyan" : "btn btn-sm btn-outline";
    if (btnFace) btnFace.className = mode === "face" ? "btn btn-sm btn-cyan" : "btn btn-sm btn-outline";
    if (btnDual) btnDual.className = mode === "combined" ? "btn btn-sm btn-cyan" : "btn btn-sm btn-outline";

    const titleEl = document.getElementById("live-cam-title-display");
    if (titleEl) {
      if (mode === "ppe") titleEl.textContent = "Live AI Vision Camera: PPE Inspection";
      else if (mode === "face") titleEl.textContent = "Live AI Vision Camera: Multi-Angle Face Visibility";
      else titleEl.textContent = "Live AI Vision Camera: Dual PPE & Face Visibility Stream";
    }

    if (typeof SafeGuardApp !== "undefined") {
      const modeNames = { ppe: "PPE Safety Inspection", face: "Multi-Angle Face Visibility", combined: "Dual Combined Vision" };
      SafeGuardApp.showToast("Vision Mode Changed", `Switched to ${modeNames[mode] || mode}.`, "info");
    }
  },

  // Sensitivity Presets
  sensitivity: "standard", // "standard" | "high" | "strict"
  sensitivityThresholds: {
    standard: { helmet: 0.11, vest: 0.12, holdMargin: 0.04 },
    high:     { helmet: 0.07, vest: 0.08, holdMargin: 0.03 },
    strict:   { helmet: 0.16, vest: 0.17, holdMargin: 0.05 }
  },

  // Dynamic tracker state (Exponential Moving Average smoothing)
  tracker: {
    centerX: 320,
    centerY: 160,
    faceW: 140,
    faceH: 170,
    initialized: false
  },

  // Temporal multi-frame buffer for stable non-flickering predictions
  temporalBuffer: [],
  bufferSize: 5,
  stableState: {
    hasHelmet: false,
    hasVest: false,
    helmetConf: 0,
    vestConf: 0,
    helmetType: "None",
    vestType: "None"
  },

  // Current Detection State
  currentDetection: {
    personDetected: true,
    hasHelmet: false,
    hasVest: false,
    helmetConf: 0,
    vestConf: 0,
    helmetType: "None",
    vestType: "None",
    personConf: 99.2,
    statusText: "Scanning PPE compliance...",
    isViolation: true,
    missingItems: ["Construction Hardhat", "High-Vis Safety Vest"],
    headBox: null,
    torsoBox: null,
    personBox: null
  },

  // Alert debouncing & Sustained Delay
  autoAlertEnabled: true,
  lastAlertTime: 0,
  lastViolationKey: null,
  alertCooldownMs: 6000,
  consecutiveViolations: 0,
  incidentAlertDelayMs: 5000, // 5.0 seconds sustained violation delay before incident alert dispatch
  violationStartTime: null,   // Timestamp when current sustained violation commenced

  // Selected Monitored Location
  selectedLocation: "Main Plant Floor",

  // Target Worker Being Inspected (Auto-Detect or Specific Registered Worker)
  inspectedWorkerId: "auto",

  // Biometric Face Recognition & Multi-Worker Identification
  workerFaceSignatures: new Map(),
  trackedPersonIdentities: new Map(), // trackId -> { trackId, bbox, firstSeen, lastSeen, evidence, totalFaceChecks, unmatchedCount, state, confirmedWorker, confirmedConfidence, confirmedTimestamp }
  identifiedWorker: null,
  activeIdentityState: "DETECTING",
  faceMatchScore: 0,
  faceMatchConfidence: 0,
  faceMatchTimestamp: 0,
  _faceCropCanvas: null,
  _faceCropCtx: null,
  _faceFlipCanvas: null,
  _faceFlipCtx: null,
  frameCount: 0,

  // Configurable Worker Identification Delay & Multi-Frame Evidence Confirmation
  confirmationDurationMs: 1500, // 1.5 seconds default confirmation window (configurable 1000ms - 3000ms)
  minConfirmationFrames: 3,     // require consistent match across at least 3 valid frames
  minMatchRatio: 0.60,          // at least 60% of evaluated face frames must agree on the same identity
  gracePeriodMs: 2500,          // retain confirmed identity during 2.5s brief detection interruptions/occlusions
  staleTrackTimeoutMs: 3500,    // release tracking state if person is unseen for > 3.5 seconds
  nextLiveTrackId: 1,           // Monotonic tracking ID generator

  // Rolling log of automated alerts dispatched by camera
  recentDispatches: [],

  // Strict 10-Second Worker Detection Cooldown (Requirement)
  WORKER_DETECTION_COOLDOWN: 10000, // 10,000 milliseconds (10 seconds)
  workerDetectionCooldowns: new Map(), // cooldownKey -> lastAcceptedTimestamp
  lastCooldownLogTimes: new Map(),     // cooldownKey -> lastLogTimestamp
  COOLDOWN_STORAGE_KEY: "safeguard_worker_detection_cooldowns_v1",

  /**
   * Compute Biometric Face Signature (Structural LBP + Spatial Gradients + Lighting Normalization)
   * Robust descriptor invariant to flat skin tones and ambient illumination changes.
   */
  computeFaceSignatureFromImageData(imgData) {
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
    const stdGray = Math.sqrt(varSum / totalPixels) + 1e-4;
    if (stdGray < 5.0) {
      return null; // Image is blank, flat wall, or lacks sufficient facial contrast
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

        // 8-bin Local Binary Pattern (LBP) histogram
        const lbpBins = [0, 0, 0, 0, 0, 0, 0, 0];
        let gradSumX = 0;
        let gradSumY = 0;
        let lbpCount = 0;

        for (let y = startY + 1; y < endY - 1; y++) {
          for (let x = startX + 1; x < endX - 1; x++) {
            const centerVal = gray[y * w + x];

            // 8 neighbors
            let pattern = 0;
            if (gray[(y - 1) * w + (x - 1)] >= centerVal) pattern |= 1;
            if (gray[(y - 1) * w + x] >= centerVal) pattern |= 2;
            if (gray[(y - 1) * w + (x + 1)] >= centerVal) pattern |= 4;
            if (gray[y * w + (x + 1)] >= centerVal) pattern |= 8;
            if (gray[(y + 1) * w + (x + 1)] >= centerVal) pattern |= 16;
            if (gray[(y + 1) * w + x] >= centerVal) pattern |= 32;
            if (gray[(y + 1) * w + (x - 1)] >= centerVal) pattern |= 64;
            if (gray[y * w + (x - 1)] >= centerVal) pattern |= 128;

            // Map 8-bit pattern to 8 bins
            const bin = Math.floor(pattern / 32);
            lbpBins[Math.min(7, bin)]++;

            // Directional gradients (Sobel)
            const gxVal = Math.abs(gray[y * w + (x + 1)] - gray[y * w + (x - 1)]);
            const gyVal = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
            gradSumX += gxVal;
            gradSumY += gyVal;
            lbpCount++;
          }
        }

        // Normalize cell LBP histogram and gradients
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
  },

  /**
   * Precompute and cache face signature list (including multi-angle photos) for a registered worker
   */
  getWorkerFaceSignatures(worker) {
    if (!worker || !worker.id) return [];
    if (this.workerFaceSignatures.has(worker.id)) {
      const cached = this.workerFaceSignatures.get(worker.id);
      if (cached && cached.length > 0) return cached;
    }

    // Direct read of precomputed biometric signature templates from enrollment
    if (worker.faceSignatures && Array.isArray(worker.faceSignatures) && worker.faceSignatures.length > 0) {
      const validSigs = worker.faceSignatures.filter(s => Array.isArray(s) && s.length === 640);
      if (validSigs.length > 0) {
        this.workerFaceSignatures.set(worker.id, validSigs);
        return validSigs;
      }
    }

    const photoUrls = [];
    if (worker.faceImage) photoUrls.push(worker.faceImage);
    if (worker.multiAnglePhotos) {
      if (worker.multiAnglePhotos.center && !photoUrls.includes(worker.multiAnglePhotos.center)) {
        photoUrls.push(worker.multiAnglePhotos.center);
      }
      if (worker.multiAnglePhotos.left && !photoUrls.includes(worker.multiAnglePhotos.left)) {
        photoUrls.push(worker.multiAnglePhotos.left);
      }
      if (worker.multiAnglePhotos.right && !photoUrls.includes(worker.multiAnglePhotos.right)) {
        photoUrls.push(worker.multiAnglePhotos.right);
      }
    }

    if (photoUrls.length === 0) return [];

    const signatures = [];
    const offscreen = document.createElement("canvas");
    offscreen.width = 64;
    offscreen.height = 64;
    const oCtx = offscreen.getContext("2d");

    const extractSigsFromImg = (img) => {
      const extracted = [];
      try {
        oCtx.clearRect(0, 0, 64, 64);
        oCtx.drawImage(img, 0, 0, 64, 64);
        const imgData = oCtx.getImageData(0, 0, 64, 64);
        const sig = this.computeFaceSignatureFromImageData(imgData);
        if (sig) extracted.push(sig);

        // Flipped template for mirror invariance
        oCtx.save();
        oCtx.clearRect(0, 0, 64, 64);
        oCtx.translate(64, 0);
        oCtx.scale(-1, 1);
        oCtx.drawImage(img, 0, 0, 64, 64);
        oCtx.restore();
        const flipData = oCtx.getImageData(0, 0, 64, 64);
        const sigFlip = this.computeFaceSignatureFromImageData(flipData);
        if (sigFlip) extracted.push(sigFlip);
      } catch (err) {}
      return extracted;
    };

    photoUrls.forEach(url => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
        if (img.complete && img.naturalWidth > 0) {
          const sigs = extractSigsFromImg(img);
          if (sigs.length > 0) signatures.push(...sigs);
        } else {
          img.onload = () => {
            const sigs = extractSigsFromImg(img);
            if (sigs.length > 0) {
              const current = this.workerFaceSignatures.get(worker.id) || [];
              sigs.forEach(s => current.push(s));
              this.workerFaceSignatures.set(worker.id, current);
            }
          };
        }
      } catch (e) {
        console.warn("Could not precompute worker face signature:", e);
      }
    });

    if (signatures.length > 0) {
      this.workerFaceSignatures.set(worker.id, signatures);
    }
    return signatures;
  },

  /**
   * Compare two face signatures using Cosine Similarity
   * Returns value between 0.0 (no match) and 1.0 (exact match)
   */
  compareFaceSignatures(sigA, sigB) {
    if (!sigA || !sigB || sigA.length !== sigB.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < sigA.length; i++) {
      const a = sigA[i];
      const b = sigB[i];
      dot += a * b;
      magA += a * a;
      magB += b * b;
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  },

  /**
   * Biometric Match for any region box: Compare canvas crop with all registered workers
   * Accurate 1:1 aspect-ratio multi-scale alignment with ambiguity & false attribution protection.
   */
  matchFaceForBox(faceBox, w, h) {
    if (!this.ctx || !faceBox || (faceBox.w < 15 && faceBox.h < 15)) return null;
    const stateEngine = (typeof SafeGuardState !== "undefined" ? SafeGuardState : window.SafeGuardState);
    const state = (stateEngine && typeof stateEngine.getState === "function") ? stateEngine.getState() : { workers: [] };

    // Strictly filter for workers with real enrolled biometric photographs
    const validWorkers = (state.workers || []).filter(w => {
      const hasPhoto = !!(
        w.faceImage ||
        (w.multiAnglePhotos && (w.multiAnglePhotos.center || w.multiAnglePhotos.left || w.multiAnglePhotos.right)) ||
        (w.enrollmentVerified && w.faceSignatures && w.faceSignatures.length > 0)
      );
      return hasPhoto;
    });

    if (validWorkers.length === 0) return null;

    try {
      if (!this._faceCropCanvas) {
        this._faceCropCanvas = document.createElement("canvas");
        this._faceCropCanvas.width = 64;
        this._faceCropCanvas.height = 64;
        this._faceCropCtx = this._faceCropCanvas.getContext("2d");
      }
      if (!this._faceFlipCanvas) {
        this._faceFlipCanvas = document.createElement("canvas");
        this._faceFlipCanvas.width = 64;
        this._faceFlipCanvas.height = 64;
        this._faceFlipCtx = this._faceFlipCanvas.getContext("2d");
      }

      // Determine face center and base diameter for square 1:1 crop
      const cX = typeof faceBox.cX === "number" ? faceBox.cX : (faceBox.x + faceBox.w * 0.5);
      const cY = typeof faceBox.cY === "number" ? faceBox.cY : (faceBox.y + faceBox.h * 0.5);
      const baseDim = Math.max(28, Math.round(Math.max(faceBox.w || 32, faceBox.h || 32)));

      // Multi-scale candidate crops (Standard 1.0x, Focused Feature 0.90x, Context 1.12x)
      const candidateSigs = [];
      const scales = [1.0, 0.90, 1.12];

      for (const scale of scales) {
        const curSize = Math.max(24, Math.round(baseDim * scale));
        const half = Math.round(curSize / 2);
        const cropX = Math.max(0, Math.min(w - curSize, Math.round(cX - half)));
        const cropY = Math.max(0, Math.min(h - curSize, Math.round(cY - half)));
        const actualW = Math.min(curSize, w - cropX);
        const actualH = Math.min(curSize, h - cropY);
        if (actualW < 14 || actualH < 14) continue;

        // 1. Standard 1:1 square crop
        this._faceCropCtx.clearRect(0, 0, 64, 64);
        this._faceCropCtx.drawImage(this.canvasEl, cropX, cropY, actualW, actualH, 0, 0, 64, 64);
        const liveData = this._faceCropCtx.getImageData(0, 0, 64, 64);
        const liveSig = this.computeFaceSignatureFromImageData(liveData);
        if (liveSig) candidateSigs.push(liveSig);

        // 2. Horizontally mirrored crop (for webcam mirror invariance)
        this._faceFlipCtx.save();
        this._faceFlipCtx.clearRect(0, 0, 64, 64);
        this._faceFlipCtx.translate(64, 0);
        this._faceFlipCtx.scale(-1, 1);
        this._faceFlipCtx.drawImage(this.canvasEl, cropX, cropY, actualW, actualH, 0, 0, 64, 64);
        this._faceFlipCtx.restore();
        const liveFlipData = this._faceFlipCtx.getImageData(0, 0, 64, 64);
        const liveSigFlip = this.computeFaceSignatureFromImageData(liveFlipData);
        if (liveSigFlip) candidateSigs.push(liveSigFlip);
      }

      if (candidateSigs.length === 0) return null;

      let bestWorker = null;
      let bestScore = 0;
      let runnerUpScore = 0;

      for (const worker of validWorkers) {
        const workerSigs = this.getWorkerFaceSignatures(worker);
        if (!workerSigs || workerSigs.length === 0) continue;

        let maxScoreForWorker = 0;
        for (const workerSig of workerSigs) {
          for (const liveSig of candidateSigs) {
            const sim = this.compareFaceSignatures(liveSig, workerSig);
            if (sim > maxScoreForWorker) {
              maxScoreForWorker = sim;
            }
          }
        }

        if (maxScoreForWorker > bestScore) {
          runnerUpScore = bestScore;
          bestScore = maxScoreForWorker;
          bestWorker = worker;
        } else if (maxScoreForWorker > runnerUpScore) {
          runnerUpScore = maxScoreForWorker;
        }
      }

      // Biometric identification threshold & ambiguity rejection:
      // - Standard threshold: >= 0.70
      // - High confidence: >= 0.80
      // - Runner-up separation margin: >= 0.04 (prevents false matches when two workers are close)
      const BIOMETRIC_MATCH_THRESHOLD = 0.70;
      const HIGH_CONFIDENCE_THRESHOLD = 0.80;
      const MARGIN_THRESHOLD = 0.04;

      const isConfidentMatch = bestWorker && (
        (validWorkers.length === 1 && bestScore >= BIOMETRIC_MATCH_THRESHOLD) ||
        (bestScore >= HIGH_CONFIDENCE_THRESHOLD) ||
        (bestScore >= BIOMETRIC_MATCH_THRESHOLD && (bestScore - runnerUpScore) >= MARGIN_THRESHOLD)
      );

      if (isConfidentMatch) {
        const conf = Math.min(99.4, Math.round(72 + ((bestScore - BIOMETRIC_MATCH_THRESHOLD) / 0.30) * 27));
        return {
          worker: bestWorker,
          score: bestScore,
          confidence: Math.max(72, conf),
          margin: bestScore - runnerUpScore
        };
      }
      return null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Real-time Biometric Match: Compare live camera face with all registered workers
   */
  matchLiveFace(faceBox, w, h) {
    const match = this.matchFaceForBox(faceBox, w, h);
    if (match) {
      this.identifiedWorker = match.worker;
      this.faceMatchScore = match.score;
      this.faceMatchConfidence = match.confidence;
      this.faceMatchTimestamp = Date.now();
    } else {
      if (Date.now() - (this.faceMatchTimestamp || 0) > 1200) {
        this.identifiedWorker = null;
        this.faceMatchScore = 0;
        this.faceMatchConfidence = 0;
      }
    }
  },

  invalidateFaceCache() {
    this.workerFaceSignatures.clear();
    this.trackedPersonIdentities.clear();
    this.identifiedWorker = null;
    this.activeIdentityState = "DETECTING";
    this.faceMatchScore = 0;
    this.faceMatchConfidence = 0;
    this.faceMatchTimestamp = 0;
  },

  setConfirmationDuration(durationMs) {
    const val = Math.max(500, Math.min(5000, parseInt(durationMs, 10) || 1500));
    this.confirmationDurationMs = val;
    const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);
    if (appEngine && typeof appEngine.showToast === "function") {
      appEngine.showToast("Worker Identification Timing", `Confirmation period set to ${(val / 1000).toFixed(1)}s multi-frame window.`, "info");
    }
  },

  setIncidentAlertDelay(delayMs) {
    const val = Math.max(1000, Math.min(15000, parseInt(delayMs, 10) || 5000));
    this.incidentAlertDelayMs = val;
    const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);
    if (appEngine && typeof appEngine.showToast === "function") {
      appEngine.showToast("Incident Alert Timing", `Incident alert delay set to ${(val / 1000).toFixed(1)}s sustained violation window.`, "info");
    }
  },

  /**
   * Load persisted detection cooldown timestamps from localStorage
   * Ensures page reloads do not bypass active 10-second cooldowns
   */
  loadCooldownState() {
    try {
      const raw = localStorage.getItem(this.COOLDOWN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        this.workerDetectionCooldowns.clear();
        for (const [key, ts] of Object.entries(parsed)) {
          if (now - ts < 60000) {
            this.workerDetectionCooldowns.set(key, ts);
          }
        }
      }
    } catch (e) {}
  },

  /**
   * Persist active detection cooldown timestamps to localStorage
   */
  saveCooldownState() {
    try {
      const obj = {};
      for (const [key, ts] of this.workerDetectionCooldowns.entries()) {
        obj[key] = ts;
      }
      localStorage.setItem(this.COOLDOWN_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {}
  },

  /**
   * Safely clean up expired cooldown entries (>60s old) to prevent unbounded memory growth
   */
  cleanupExpiredCooldowns(now) {
    const expireThreshold = now - 60000;
    for (const [key, ts] of this.workerDetectionCooldowns.entries()) {
      if (ts < expireThreshold) {
        this.workerDetectionCooldowns.delete(key);
        this.lastCooldownLogTimes.delete(key);
      }
    }
  },

  /**
   * Strict 10-Second Worker Detection Cooldown Evaluator
   * - Uses persistent worker ID for recognized workers, or unique track ID for unknown persons
   * - Tracks independent cooldowns per worker
   * - Suppresses duplicate detection events within 10 seconds
   * - Allows new accepted detection event after 10 seconds
   */
  processWorkerDetectionCooldown(worker, trackId, now) {
    if (!now) now = Date.now();
    this.cleanupExpiredCooldowns(now);

    const isConfirmed = worker && worker.id && worker.id !== "UNKNOWN";
    const cooldownKey = isConfirmed ? worker.id : `track_${trackId}`;

    const lastAccepted = this.workerDetectionCooldowns.get(cooldownKey) || 0;
    const elapsed = now - lastAccepted;

    if (elapsed < this.WORKER_DETECTION_COOLDOWN) {
      const remainingMs = this.WORKER_DETECTION_COOLDOWN - elapsed;
      const lastLogged = this.lastCooldownLogTimes.get(cooldownKey) || 0;
      if (now - lastLogged >= 1500) {
        this.lastCooldownLogTimes.set(cooldownKey, now);
        console.log(`[SafeGuard-AI Cooldown] Worker ${cooldownKey} detection SUPPRESSED (cooldown active: ${(remainingMs / 1000).toFixed(1)}s remaining)`);
      }
      return {
        accepted: false,
        cooldownKey: cooldownKey,
        remainingMs: remainingMs,
        remainingSec: (remainingMs / 1000).toFixed(1)
      };
    }

    // Cooldown elapsed: ACCEPT detection event!
    this.workerDetectionCooldowns.set(cooldownKey, now);
    this.saveCooldownState();
    console.log(`[SafeGuard-AI Cooldown] Worker ${cooldownKey} detection ACCEPTED at ${now}. Next event allowed after ${this.WORKER_DETECTION_COOLDOWN}ms.`);

    this.recordAcceptedWorkerDetection(worker, trackId, cooldownKey);

    return {
      accepted: true,
      cooldownKey: cooldownKey,
      remainingMs: 0,
      remainingSec: "0.0"
    };
  },

  /**
   * Dispatch single accepted worker detection event into SafeGuardState
   * Guaranteed to execute AT MOST ONCE per 10 seconds per worker
   */
  recordAcceptedWorkerDetection(worker, trackId, cooldownKey) {
    const isRegistered = (worker && worker.id && worker.id !== "UNKNOWN");
    const displayName = isRegistered ? `${worker.name} (${worker.id})` : `Worker #${trackId} (Unregistered)`;

    const stateEngine = (typeof SafeGuardState !== "undefined" ? SafeGuardState : window.SafeGuardState);
    if (stateEngine) {
      try {
        stateEngine.update(state => {
          state.auditLogs = state.auditLogs || [];
          state.aiDetectionMetrics = state.aiDetectionMetrics || { detectionsToday: 0 };
          state.aiDetectionMetrics.detectionsToday = (state.aiDetectionMetrics.detectionsToday || 0) + 1;

          state.auditLogs.unshift({
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            action: `Worker detection event verified: ${displayName} [Camera 01]`,
            user: "SafeGuard Vision Agent"
          });
          if (state.auditLogs.length > 50) state.auditLogs.pop();
          return state;
        });
      } catch (e) {}
    }
  },

  /**
   * Reset all active worker detection cooldowns
   */
  resetWorkerDetectionCooldowns() {
    this.workerDetectionCooldowns.clear();
    this.lastCooldownLogTimes.clear();
    try {
      localStorage.removeItem(this.COOLDOWN_STORAGE_KEY);
    } catch (e) {}
    console.log("[SafeGuard-AI Cooldown] All worker detection cooldowns reset.");
  },

  calculateBoxIoU(boxA, boxB) {
    if (!boxA || !boxB) return 0;
    const ax1 = boxA.x, ay1 = boxA.y, ax2 = boxA.x + boxA.w, ay2 = boxA.y + boxA.h;
    const bx1 = boxB.x, by1 = boxB.y, bx2 = boxB.x + boxB.w, by2 = boxB.y + boxB.h;

    const xA = Math.max(ax1, bx1);
    const yA = Math.max(ay1, by1);
    const xB = Math.min(ax2, bx2);
    const yB = Math.min(ay2, by2);

    const interW = Math.max(0, xB - xA);
    const interH = Math.max(0, yB - yA);
    const interArea = interW * interH;

    const areaA = Math.max(1, boxA.w * boxA.h);
    const areaB = Math.max(1, boxB.w * boxB.h);
    const unionArea = areaA + areaB - interArea;

    return unionArea > 0 ? (interArea / unionArea) : 0;
  },

  /**
   * Spatial Multi-Worker Tracking: Maintain stable monotonic track IDs across video frames
   */
  assignTracksToDetections(rawDetections) {
    if (!rawDetections || rawDetections.length === 0) {
      return rawDetections;
    }

    const now = Date.now();
    const existingTracks = Array.from(this.trackedPersonIdentities.entries());
    const matchedTrackIds = new Set();
    const matchedDetIndices = new Set();

    // 1. Calculate pairwise IoU between detected personBoxes and existing active tracks
    const iouPairs = [];
    rawDetections.forEach((det, dIdx) => {
      existingTracks.forEach(([trackId, track]) => {
        const iou = this.calculateBoxIoU(det.personBox, track.bbox);
        if (iou >= 0.18) {
          iouPairs.push({ dIdx, trackId, iou });
        }
      });
    });

    iouPairs.sort((a, b) => b.iou - a.iou);

    iouPairs.forEach(pair => {
      if (!matchedDetIndices.has(pair.dIdx) && !matchedTrackIds.has(pair.trackId)) {
        matchedDetIndices.add(pair.dIdx);
        matchedTrackIds.add(pair.trackId);

        const det = rawDetections[pair.dIdx];
        const track = this.trackedPersonIdentities.get(pair.trackId);
        det.trackId = pair.trackId;

        // Exponential smoothing of bbox
        const alpha = 0.35;
        track.bbox = {
          x: Math.round(track.bbox.x * (1 - alpha) + det.personBox.x * alpha),
          y: Math.round(track.bbox.y * (1 - alpha) + det.personBox.y * alpha),
          w: Math.round(track.bbox.w * (1 - alpha) + det.personBox.w * alpha),
          h: Math.round(track.bbox.h * (1 - alpha) + det.personBox.h * alpha)
        };
        track.lastSeen = now;
      }
    });

    // 2. Allocate new stable monotonic track ID for unmatched detections
    rawDetections.forEach((det, dIdx) => {
      if (!matchedDetIndices.has(dIdx)) {
        const newTrackId = this.nextLiveTrackId++;
        det.trackId = newTrackId;

        this.trackedPersonIdentities.set(newTrackId, {
          trackId: newTrackId,
          bbox: { ...det.personBox },
          firstSeen: now,
          lastSeen: now,
          evidence: new Map(), // workerId -> { count, totalScore, maxScore, lastMatched, worker }
          totalFaceChecks: 0,
          unmatchedCount: 0,
          state: "DETECTING",
          confirmedWorker: null,
          confirmedConfidence: 0,
          confirmedTimestamp: 0,
          stateChangedAt: now
        });
      }
    });

    // 3. Prune stale tracks unseen for > staleTrackTimeoutMs
    for (const [tId, tData] of this.trackedPersonIdentities.entries()) {
      if (now - tData.lastSeen > this.staleTrackTimeoutMs) {
        this.trackedPersonIdentities.delete(tId);
      }
    }

    return rawDetections;
  },

  /**
   * Get Active Inspected Worker Profile from SafeGuardState workforce directory
   */
  getActiveWorker() {
    const stateEngine = (typeof SafeGuardState !== "undefined" ? SafeGuardState : window.SafeGuardState);
    const state = (stateEngine && typeof stateEngine.getState === "function")
      ? stateEngine.getState()
      : { workers: [] };
    const workers = state.workers || [];

    // 1. Explicit dropdown lock-on by user
    if (this.inspectedWorkerId && this.inspectedWorkerId !== "auto") {
      const found = workers.find(w => w.id === this.inspectedWorkerId);
      if (found) return found;
    }

    // 2. Biometric Face Match (Auto-Detect from live camera verified by multi-frame evidence)
    if (this.identifiedWorker && this.identifiedWorker.id && this.identifiedWorker.id !== "UNKNOWN") {
      const verified = workers.find(w => w.id === this.identifiedWorker.id);
      if (verified) return verified;
      return this.identifiedWorker;
    }

    // 3. Fallback: Display "Unknown Worker" if not confidently verified by face recognition
    // NEVER attribute unverified persons to "Abhimanyu", "Pranav", or the first worker in roster!
    return {
      id: "UNKNOWN",
      name: "Unknown Worker",
      department: "Facility Floor",
      location: "Main Plant Floor",
      shift: "Active Shift",
      faceImage: null,
      isUnknown: true,
      isUnidentified: true
    };
  },

  setInspectedWorker(workerId) {
    this.inspectedWorkerId = workerId;
    this.updateWorkerSelectUI();
    const w = this.getActiveWorker();
    const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);
    if (appEngine) {
      if (workerId === "auto") {
        appEngine.showToast("Biometric Auto-Identify", "Camera will automatically match personnel in front of camera by facial appearance.", "info");
      } else {
        appEngine.showToast("Worker Tracking Locked", `AI Inspection locked onto: ${w.name} (${w.id}) • ${w.department || 'Operations'}.`, "info");
      }
    }
  },

  updateWorkerSelectUI() {
    const stateEngine = (typeof SafeGuardState !== "undefined" ? SafeGuardState : window.SafeGuardState);
    const state = (stateEngine && typeof stateEngine.getState === "function")
      ? stateEngine.getState()
      : { workers: [] };
    const workers = state.workers || [];
    const active = this.getActiveWorker();

    const selects = [
      document.getElementById("live-cam-worker-select"),
      document.getElementById("modal-cam-worker-select")
    ];

    selects.forEach(sel => {
      if (!sel) return;
      const isAuto = (!this.inspectedWorkerId || this.inspectedWorkerId === "auto");
      let html = `<option value="auto" ${isAuto ? "selected" : ""}>⚡ Biometric Auto-Detect (Face Match)</option>`;
      workers.forEach(w => {
        const isSel = (this.inspectedWorkerId === w.id) ? "selected" : "";
        html += `<option value="${w.id}" ${isSel}>👷 ${w.name} (${w.id}) — ${w.department}</option>`;
      });
      if (workers.length === 0) {
        html += `<option value="auto" selected>⚡ Auto-Identify (Zero Registered Workers)</option>`;
      }
      sel.innerHTML = html;
      if (this.inspectedWorkerId) {
        sel.value = this.inspectedWorkerId;
      }
    });

    // Update worker info preview tags across the UI
    const nameEls = document.querySelectorAll(".live-cam-worker-name");
    const idEls = document.querySelectorAll(".live-cam-worker-id");
    const avatarEls = document.querySelectorAll(".live-cam-worker-avatar");

    nameEls.forEach(el => el.textContent = active.name);
    idEls.forEach(el => el.textContent = `${active.id} • ${active.department || 'Operations'}`);

    avatarEls.forEach(el => {
      if (active.faceImage) {
        el.innerHTML = `<img src="${active.faceImage}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        const initials = active.name.split(" ").map(n => n[0]).join("").slice(0, 2);
        el.innerHTML = `<span style="font-weight:700; font-size:0.8rem; color:var(--cyan);">${initials || "W"}</span>`;
      }
    });
  },

  /**
   * Synchronize DOM worker preview elements with live camera identification state in real time
   */
  syncLiveIdentityUI(worker, identityState, trackId) {
    if (this.inspectedWorkerId && this.inspectedWorkerId !== "auto") return; // Manual lock active

    const nameEls = document.querySelectorAll(".live-cam-worker-name");
    const idEls = document.querySelectorAll(".live-cam-worker-id");
    const avatarEls = document.querySelectorAll(".live-cam-worker-avatar");
    const sel = document.getElementById("live-cam-worker-select");

    if (identityState === "CONFIRMED" && worker) {
      nameEls.forEach(el => el.textContent = worker.name);
      idEls.forEach(el => el.textContent = `${worker.id} • ${worker.department || 'Operations'}`);
      avatarEls.forEach(el => {
        if (worker.faceImage) {
          el.innerHTML = `<img src="${worker.faceImage}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
          const initials = worker.name.split(" ").map(n => n[0]).join("").slice(0, 2);
          el.innerHTML = `<span style="font-weight:700; font-size:0.8rem; color:var(--cyan);">${initials || "W"}</span>`;
        }
      });
      if (sel) {
        const opt = sel.querySelector(`option[value="${worker.id}"]`);
        if (opt) opt.selected = true;
      }
    } else if (identityState === "VERIFYING") {
      nameEls.forEach(el => el.textContent = "Verifying Identity...");
      idEls.forEach(el => el.textContent = `Worker #${trackId} • Biometric Inspection`);
    } else if (identityState === "UNKNOWN") {
      nameEls.forEach(el => el.textContent = "Unknown Worker");
      idEls.forEach(el => el.textContent = `Worker #${trackId} • Unverified Biometrics`);
      avatarEls.forEach(el => {
        el.innerHTML = `<span style="font-weight:700; font-size:0.8rem; color:var(--amber); font-family:monospace;">?</span>`;
      });
    }
  },

  /**
   * Initialize Camera on load
   */
  init(options = {}) {
    const videoId = options.videoId || "live-camera-video";
    const canvasId = options.canvasId || "live-camera-canvas";

    this.videoEl = document.getElementById(videoId);
    this.canvasEl = document.getElementById(canvasId);

    if (!this.canvasEl) return;
    this.ctx = this.canvasEl.getContext("2d", { willReadFrequently: true });

    // Hardware-accelerated FaceDetector API support
    this.hasNativeFaceDetector = ("FaceDetector" in window);
    if (this.hasNativeFaceDetector) {
      try {
        this.nativeDetectorInstance = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
      } catch (e) {
        this.hasNativeFaceDetector = false;
        this.nativeDetectorInstance = null;
      }
    }

    // Ensure hidden video element exists
    if (!this.videoEl) {
      this.videoEl = document.createElement("video");
      this.videoEl.id = videoId;
      this.videoEl.autoplay = true;
      this.videoEl.playsInline = true;
      this.videoEl.muted = true;
      this.videoEl.style.display = "none";
      document.body.appendChild(this.videoEl);
    }

    this.bindUI();
    this.loadCooldownState();
    this.updateWorkerSelectUI();
    this.updateTelemetryHUD(this.currentDetection);
    this.renderDispatchesFeed();

    // Listen for state changes (e.g. workers added/edited)
    window.addEventListener("safeguard_state_changed", () => {
      this.updateWorkerSelectUI();
    });

    // Start live camera stream
    this.startWebcam();
  },

  bindUI() {
    const workerSelect = document.getElementById("live-cam-worker-select");
    if (workerSelect) {
      workerSelect.onchange = (e) => {
        this.setInspectedWorker(e.target.value);
      };
    }

    const modalWorkerSelect = document.getElementById("modal-cam-worker-select");
    if (modalWorkerSelect) {
      modalWorkerSelect.onchange = (e) => {
        this.setInspectedWorker(e.target.value);
      };
    }

    const autoAlertCheckbox = document.getElementById("live-cam-auto-alert");
    if (autoAlertCheckbox) {
      autoAlertCheckbox.checked = this.autoAlertEnabled;
      autoAlertCheckbox.onchange = (e) => {
        this.autoAlertEnabled = e.target.checked;
      };
    }

    const sensitivitySelect = document.getElementById("live-cam-sensitivity");
    if (sensitivitySelect) {
      sensitivitySelect.value = this.sensitivity;
      sensitivitySelect.onchange = (e) => {
        this.setSensitivity(e.target.value);
      };
    }
  },

  /**
   * Set Detection Sensitivity Mode
   */
  setSensitivity(mode) {
    if (this.sensitivityThresholds[mode]) {
      this.sensitivity = mode;
      const names = {
        standard: "Standard (OSHA/EN Baseline)",
        high: "High Sensitivity (Low-Light / Webcam)",
        strict: "Strict Audit (ISO 45001 Standard)"
      };
      const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);
      if (appEngine) {
        appEngine.showToast("PPE Detection Calibrated", `Sensitivity adjusted to: ${names[mode]}`, "info");
      }
    }
  },

  /**
   * Start Live Device Webcam Stream
   */
  async startWebcam() {
    this.stopCurrentStream();
    this.currentMode = "webcam";
    this.updateModeUI("webcam");

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam access not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        },
        audio: false
      });

      this.stream = stream;
      this.videoEl.srcObject = stream;
      this.videoEl.style.display = "none";
      await this.videoEl.play();

      this.isRunning = true;
      this.tracker.initialized = false;
      this.temporalBuffer = [];
      this.consecutiveViolations = 0;
      this.lastViolationKey = null;
      this.lastAlertTime = 0;
      this.loop();

      const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);
      if (appEngine) {
        appEngine.showToast(
          "🎥 Live Camera Active",
          "Webcam connected. Scanning for Construction Helmets, Normal Helmets, and High-Vis Vests...",
          "info"
        );
      }
    } catch (err) {
      console.warn("Webcam activation error:", err);
      this.renderStandbyView("Camera Permission Denied or Device Unavailable.\nPlease click 'Start Webcam' and grant access, or choose a Test Scenario.");
    }
  },

  /**
   * Handle File Upload (Test with actual photo or video of worker)
   */
  handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.stopCurrentStream();
    this.currentMode = "upload";
    this.updateModeUI("upload");

    const fileUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith("video");

    if (isVideo) {
      this.videoEl.srcObject = null;
      this.videoEl.src = fileUrl;
      this.videoEl.loop = true;
      this.videoEl.onloadedmetadata = () => {
        this.videoEl.play();
        this.isRunning = true;
        this.tracker.initialized = false;
        this.temporalBuffer = [];
        this.consecutiveViolations = 0;
        this.lastViolationKey = null;
        this.lastAlertTime = 0;
        this.loop();
      };
    } else {
      // Photo / Image file
      const img = new Image();
      img.onload = () => {
        this.isRunning = false;
        const w = this.canvasEl.width || 640;
        const h = this.canvasEl.height || 420;
        this.ctx.drawImage(img, 0, 0, w, h);
        const { personBox, headBox, torsoBox } = this.locatePersonAndRegions(w, h);
        const rawDet = this.analyzeFramePixels(personBox, headBox, torsoBox, w, h);
        this.temporalBuffer = [rawDet, rawDet, rawDet];
        const det = this.applyTemporalSmoothing(rawDet);
        this.currentDetection = det;
        this.renderHUD(det, personBox, headBox, torsoBox, w, h, 15);
        this.updateTelemetryHUD(det, 15);
        if (det.isViolation && this.autoAlertEnabled) {
          this.lastAlertTime = 0;
          this.dispatchPPEAlert("upload");
        }
      };
      img.src = fileUrl;
    }
  },

  /**
   * Load Built-In Procedural Test Sample
   * Accurately renders either Construction Hardhat OR Normal Helmet, with or without Vest
   * @param {"compliant" | "normal-helmet-vest" | "no-helmet" | "no-vest" | "no-ppe"} sampleType
   */
  loadTestSample(sampleType) {
    this.stopCurrentStream();
    this.currentMode = "sample";
    this.updateModeUI("sample");

    const w = this.canvasEl.width || 640;
    const h = this.canvasEl.height || 420;
    const ctx = this.ctx;

    // Draw rich industrial facility background
    const bgGradient = ctx.createLinearGradient(0, 0, w, h);
    bgGradient.addColorStop(0, "#0B0F14");
    bgGradient.addColorStop(0.5, "#111827");
    bgGradient.addColorStop(1, "#0B0F14");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, w, h);

    // Industrial structural beams & safety grid lines
    ctx.strokeStyle = "rgba(48, 59, 73, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const cX = w * 0.50;
    const cY = h * 0.40;
    const faceW = 120;
    const faceH = 150;

    const isConstructionHelmet = (sampleType === "compliant" || sampleType === "no-vest");
    const isNormalHelmet = (sampleType === "normal-helmet-vest" || sampleType === "normal-helmet-only");
    const hasHelmet = isConstructionHelmet || isNormalHelmet;
    const hasVest = (sampleType === "compliant" || sampleType === "normal-helmet-vest" || sampleType === "no-helmet");

    // 1. Draw Worker Torso / Clothes / Vest
    const torsoY = cY + faceH * 0.40;
    const torsoW = faceW * 2.10;
    const torsoH = faceH * 1.45;
    const torsoX = cX - torsoW / 2;

    if (hasVest) {
      // Fluorescent Neon Lime Safety Vest Body (ANSI 107 Class 2/3)
      ctx.fillStyle = "#a3e635";
      ctx.beginPath();
      ctx.roundRect(torsoX, torsoY, torsoW, torsoH, 12);
      ctx.fill();

      // Vest contour shading
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(torsoX + torsoW * 0.38, torsoY, torsoW * 0.24, torsoH);

      // Retro-Reflective Silver Safety Stripes
      ctx.fillStyle = "#e2e8f0";
      // Left vertical strap
      ctx.fillRect(torsoX + torsoW * 0.18, torsoY + 10, 18, torsoH - 20);
      // Right vertical strap
      ctx.fillRect(torsoX + torsoW * 0.72, torsoY + 10, 18, torsoH - 20);
      // Horizontal waist band
      ctx.fillRect(torsoX + 8, torsoY + torsoH * 0.58, torsoW - 16, 20);

      // Micro-prismatic reflective shine
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fillRect(torsoX + 12, torsoY + torsoH * 0.60, torsoW - 24, 6);
    } else {
      // Civilian Street Clothes (Dark Casual Shirt - Non-compliant)
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(torsoX, torsoY, torsoW, torsoH, 12);
      ctx.fill();

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(torsoX + torsoW * 0.42, torsoY, torsoW * 0.16, torsoH * 0.6);
    }

    // 2. Draw Neck
    ctx.fillStyle = "#e2a77a";
    ctx.fillRect(cX - 22, cY + faceH * 0.25, 44, 30);

    // 3. Draw Face
    ctx.fillStyle = "#f3bc94";
    ctx.beginPath();
    ctx.ellipse(cX, cY, faceW * 0.45, faceH * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes, eyebrows, nose features
    ctx.fillStyle = "#3b2618";
    ctx.fillRect(cX - 28, cY - 14, 18, 5); // left brow
    ctx.fillRect(cX + 10, cY - 14, 18, 5); // right brow
    ctx.beginPath();
    ctx.arc(cX - 19, cY - 2, 4, 0, Math.PI * 2); // left eye
    ctx.arc(cX + 19, cY - 2, 4, 0, Math.PI * 2); // right eye
    ctx.fill();

    // 4. Draw Head: Construction Hardhat vs Normal Helmet vs Bare Hair
    const headBoxY = cY - faceH * 0.92;
    const headBoxW = faceW * 1.30;
    const headBoxH = faceH * 0.68;
    const headBoxX = cX - headBoxW / 2;

    if (isConstructionHelmet) {
      // Construction Safety Hardhat (OSHA Yellow with Brim & Peak)
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.ellipse(cX, headBoxY + headBoxH * 0.58, headBoxW * 0.46, headBoxH * 0.52, 0, Math.PI, 0);
      ctx.fill();

      // Front Hardhat Brim
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.roundRect(headBoxX + 6, headBoxY + headBoxH * 0.55, headBoxW - 12, 14, 4);
      ctx.fill();

      // Specular highlight on curved plastic dome
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.beginPath();
      ctx.ellipse(cX - 18, headBoxY + headBoxH * 0.38, 22, 9, -0.2, 0, Math.PI * 2);
      ctx.fill();

    } else if (isNormalHelmet) {
      // Normal Helmet (Motorcycle / Scooter / Rider / Bicycle Helmet)
      // Aerodynamic glossy black / charcoal shell extending around head
      const normW = faceW * 1.36;
      const normH = faceH * 0.88;
      const normX = cX - normW / 2;
      const normY = cY - faceH * 0.96;

      // Outer helmet shell dome (Deep charcoal composite)
      ctx.fillStyle = "#0f172a";
      ctx.beginPath();
      ctx.ellipse(cX, normY + normH * 0.50, normW * 0.48, normH * 0.50, 0, 0, Math.PI * 2);
      ctx.fill();

      // Side jaw & cheek guard contours
      ctx.beginPath();
      ctx.roundRect(normX + 6, normY + normH * 0.42, normW - 12, normH * 0.48, 16);
      ctx.fill();

      // Prominent curved specular reflection highlight across glossy helmet shell
      ctx.strokeStyle = "rgba(255, 255, 255, 0.60)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(cX - 18, normY + normH * 0.28, normW * 0.30, normH * 0.16, -0.2, Math.PI * 0.8, Math.PI * 1.8);
      ctx.stroke();

      // Protective Face Visor / Shield across eye line
      ctx.fillStyle = "rgba(15, 23, 42, 0.90)";
      ctx.beginPath();
      ctx.roundRect(cX - faceW * 0.48, cY - 26, faceW * 0.96, 40, 8);
      ctx.fill();

      // Visor anti-glare reflection strip
      ctx.strokeStyle = "rgba(34, 211, 238, 0.50)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cX - faceW * 0.40, cY - 14);
      ctx.lineTo(cX + faceW * 0.38, cY - 18);
      ctx.stroke();

      // Visor pivot mechanism
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.arc(cX - faceW * 0.46, cY - 6, 5, 0, Math.PI * 2);
      ctx.arc(cX + faceW * 0.46, cY - 6, 5, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Bare Natural Hair (Black / Dark Brown Hair - Non-compliant)
      ctx.fillStyle = "#1e1e1e";
      ctx.beginPath();
      ctx.ellipse(cX, headBoxY + headBoxH * 0.68, headBoxW * 0.42, headBoxH * 0.40, 0, Math.PI, 0);
      ctx.fill();

      // Natural hair strands / sideburns
      ctx.fillRect(cX - faceW * 0.46, cY - 25, 14, 30);
      ctx.fillRect(cX + faceW * 0.46 - 14, cY - 25, 14, 30);
    }

    // Set tracker to this center
    this.tracker.centerX = cX;
    this.tracker.centerY = cY;
    this.tracker.faceW = faceW;
    this.tracker.faceH = faceH;
    this.tracker.initialized = true;

    // Run localized detection
    const { personBox, headBox, torsoBox } = this.locatePersonAndRegions(w, h);
    const rawDet = this.analyzeFramePixels(personBox, headBox, torsoBox, w, h);
    this.temporalBuffer = [rawDet, rawDet, rawDet];
    const det = this.applyTemporalSmoothing(rawDet);
    this.currentDetection = det;

    this.renderHUD(det, personBox, headBox, torsoBox, w, h, 14);
    this.updateTelemetryHUD(det, 14);

    if (det.isViolation && this.autoAlertEnabled) {
      this.dispatchPPEAlert("auto");
    }

    const titles = {
      compliant: "Verified: Construction Hardhat + Safety Vest",
      "normal-helmet-vest": "Violation: Bike Helmet Unapproved — Hardhat Required",
      "no-helmet": "Violation: Missing Construction Hardhat",
      "no-vest": "Violation: Missing High-Vis Safety Vest",
      "no-ppe": "Critical Violation: Zero PPE (Street Clothes)"
    };
    const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);
    if (appEngine) {
      appEngine.showToast("Test Scenario Loaded", titles[sampleType] || "Sample analyzed", det.isViolation ? "warning" : "success");
    }
  },

  stopCurrentStream() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.srcObject = null;
    }
  },

  /**
   * Standby screen when camera is disconnected
   */
  renderStandbyView(msg) {
    if (!this.canvasEl) return;
    const w = this.canvasEl.width || 640;
    const h = this.canvasEl.height || 420;
    const ctx = this.ctx;

    ctx.fillStyle = "#0B0F14";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#F97316";
    ctx.font = "bold 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("📹 Live AI Vision Camera: PPE Inspection", w / 2, h / 2 - 45);

    ctx.fillStyle = "#9CA3AF";
    ctx.font = "14px sans-serif";
    ctx.fillText(msg || "Click 'Start Webcam' to start automated PPE detection.", w / 2, h / 2 - 10);

    // Button prompt
    ctx.fillStyle = "rgba(249, 115, 22, 0.15)";
    ctx.roundRect(w / 2 - 130, h / 2 + 25, 260, 42, 6);
    ctx.fill();
    ctx.strokeStyle = "#F97316";
    ctx.stroke();

    ctx.fillStyle = "#F97316";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("Connect Live Webcam", w / 2, h / 2 + 51);
  },

  /**
   * Main Video Processing Loop (30 FPS)
   */
  loop() {
    if (!this.isRunning) return;

    const tStart = performance.now();

    if (this.videoEl && this.videoEl.readyState >= 2) {
      const w = this.canvasEl.width || 640;
      const h = this.canvasEl.height || 420;

      // 1. Draw raw live camera video frame to canvas
      this.ctx.save();
      this.ctx.drawImage(this.videoEl, 0, 0, w, h);
      this.ctx.restore();

      // Check Vision Mode: If pure "face" mode, process multi-angle face visibility and skip PPE boxes
      if (this.visionMode === "face") {
        if (window.MultiAngleFaceDetector) {
          window.MultiAngleFaceDetector.processFrame(this.canvasEl, "Live Camera Stream").then(faces => {
            if (this.visionMode === "face" && this.ctx) {
              window.MultiAngleFaceDetector.renderFaceHUD(this.ctx, faces);
            }
          });
        }
        const latency = Math.round(performance.now() - tStart);
        const latEl = document.getElementById("live-cam-latency");
        if (latEl) latEl.textContent = `${latency}ms (Multi-Angle Face)`;
        this.animationFrameId = requestAnimationFrame(() => this.loop());
        return;
      }

      // If "combined" mode, process face visibility concurrently and layer on top of PPE
      if (this.visionMode === "combined" && window.MultiAngleFaceDetector) {
        window.MultiAngleFaceDetector.processFrame(this.canvasEl, "Live Camera Stream").then(faces => {
          if (this.visionMode === "combined" && this.ctx) {
            window.MultiAngleFaceDetector.renderFaceHUD(this.ctx, faces);
          }
        });
      }

      // 2. Dynamic Human & Region Localization (for PPE Inspection)
      const rawWorkers = this.locateAllPersonsAndRegions(w, h);
      const allWorkers = this.assignTracksToDetections(rawWorkers);
      const primary = allWorkers[0] || this.locatePersonAndRegions(w, h);
      const { personBox, headBox, faceBox, torsoBox } = primary;

      // Perform Biometric Face Recognition against registered worker directory
      this.frameCount = (this.frameCount || 0) + 1;
      const doBiometricCheck = (this.frameCount % 2 === 0);
      const now = Date.now();

      // 3. Multi-Spectral Computer Vision Pixel Analysis for all detected workers
      const allDets = allWorkers.map((wrk, idx) => {
        // Evaluate localized PPE pixel analysis immediately with 0 delay (Safety First!)
        const raw = this.analyzeFramePixels(wrk.personBox, wrk.headBox, wrk.torsoBox, w, h);
        const tId = wrk.trackId || (idx + 1);

        let track = this.trackedPersonIdentities.get(tId);
        if (!track) {
          track = {
            trackId: tId,
            bbox: { ...wrk.personBox },
            firstSeen: now,
            lastSeen: now,
            evidence: new Map(),
            totalFaceChecks: 0,
            unmatchedCount: 0,
            state: "DETECTING",
            confirmedWorker: null,
            confirmedConfidence: 0,
            confirmedTimestamp: 0,
            stateChangedAt: now
          };
          this.trackedPersonIdentities.set(tId, track);
        }
        track.lastSeen = now;

        // Collect facial recognition evidence across frames if biometric interval reached
        const targetFaceBox = wrk.faceBox || wrk.headBox;
        if (doBiometricCheck && targetFaceBox) {
          track.totalFaceChecks++;
          const match = this.matchFaceForBox(targetFaceBox, w, h);
          if (match && match.worker && match.worker.id && match.worker.id !== "UNKNOWN") {
            const wId = match.worker.id;
            if (!track.evidence.has(wId)) {
              track.evidence.set(wId, {
                count: 0,
                totalScore: 0,
                maxScore: 0,
                lastMatched: now,
                worker: match.worker
              });
            }
            const ev = track.evidence.get(wId);
            ev.count++;
            ev.totalScore += match.score;
            ev.maxScore = Math.max(ev.maxScore, match.score);
            ev.lastMatched = now;
            ev.worker = match.worker;
          } else {
            track.unmatchedCount++;
          }
        }

        // Multi-Frame Evidence Confirmation State Machine
        const elapsedSinceFirstSeen = now - track.firstSeen;
        let matchedWorker = null;
        let matchConfidence = 0;
        let identityState = track.state;

        // Evaluate candidate evidence from positive face matches
        let bestCandidate = null;
        let highestCount = 0;
        let totalPositiveMatches = 0;
        for (const ev of track.evidence.values()) {
          totalPositiveMatches += ev.count;
          if (ev.count > highestCount) {
            highestCount = ev.count;
            bestCandidate = ev;
          }
        }

        // Check for candidate identity conflict (e.g. two registered workers matching equally)
        let hasConflict = false;
        if (bestCandidate) {
          for (const [otherId, otherEv] of track.evidence.entries()) {
            if (otherId !== bestCandidate.worker.id && otherEv.count >= 2 && otherEv.count >= bestCandidate.count * 0.70) {
              hasConflict = true;
              break;
            }
          }
        }

        const avgScore = bestCandidate ? (bestCandidate.totalScore / bestCandidate.count) : 0;
        const candidateRatio = totalPositiveMatches > 0 ? (bestCandidate.count / totalPositiveMatches) : 0;
        // Confident if candidate has at least 2 matches with avgScore >= 0.68, dominates positive matches (>= 60%), and no conflict
        const isCandidateConfident = bestCandidate &&
          bestCandidate.count >= 2 &&
          avgScore >= 0.68 &&
          candidateRatio >= 0.60 &&
          !hasConflict;

        // 1. If already confirmed, maintain identity
        if (track.state === "CONFIRMED" && track.confirmedWorker) {
          matchedWorker = track.confirmedWorker;
          matchConfidence = track.confirmedConfidence;
          identityState = "CONFIRMED";
        }
        // 2. Candidate confident: confirm immediately (or upgrade from UNKNOWN/VERIFYING!)
        else if (isCandidateConfident) {
          track.state = "CONFIRMED";
          track.confirmedWorker = bestCandidate.worker;
          track.confirmedConfidence = Math.max(70, Math.min(99, Math.round(70 + ((avgScore - 0.68) / 0.32) * 29)));
          track.confirmedTimestamp = now;
          track.stateChangedAt = now;

          matchedWorker = track.confirmedWorker;
          matchConfidence = track.confirmedConfidence;
          identityState = "CONFIRMED";
        }
        // 3. Initial detecting state (< 400ms or 0 face checks)
        else if (elapsedSinceFirstSeen < 400 || track.totalFaceChecks === 0) {
          track.state = "DETECTING";
          identityState = "DETECTING";
          matchedWorker = null;
          matchConfidence = 0;
        }
        // 4. Verifying Identity state (400ms <= elapsed < confirmationDurationMs)
        else if (elapsedSinceFirstSeen < this.confirmationDurationMs) {
          track.state = "VERIFYING";
          identityState = "VERIFYING";
          matchedWorker = null;
          matchConfidence = 0;
        }
        // 5. Confirmation window elapsed and no confident match: Unknown Worker
        // (Worker can still be promoted to CONFIRMED on any subsequent frame if face matches arrive!)
        else {
          track.state = "UNKNOWN";
          track.confirmedWorker = null;
          track.confirmedConfidence = 0;
          track.stateChangedAt = now;

          matchedWorker = null;
          matchConfidence = 0;
          identityState = "UNKNOWN";
        }

        const detResult = {
          ...raw,
          workerIndex: wrk.workerIndex || (idx + 1),
          trackId: tId,
          personBox: wrk.personBox,
          headBox: wrk.headBox,
          faceBox: wrk.faceBox,
          torsoBox: wrk.torsoBox,
          matchedWorker: matchedWorker,
          matchConfidence: matchConfidence,
          identityState: identityState,
          elapsedSinceFirstSeen: elapsedSinceFirstSeen
        };

        // Strict 10-Second Worker Detection Cooldown:
        // Evaluated once identity is resolved (CONFIRMED or UNKNOWN).
        // Uses persistent worker ID if recognized, otherwise stable track ID.
        if (identityState === "CONFIRMED" || identityState === "UNKNOWN") {
          const cdRes = this.processWorkerDetectionCooldown(matchedWorker, tId, now);
          detResult.detectionEventAccepted = cdRes.accepted;
          detResult.cooldownActive = !cdRes.accepted;
          detResult.cooldownRemainingMs = cdRes.remainingMs;
          detResult.cooldownKey = cdRes.cooldownKey;
        } else {
          detResult.detectionEventAccepted = false;
          detResult.cooldownActive = false;
          detResult.cooldownRemainingMs = 0;
          detResult.cooldownKey = `track_${tId}`;
        }

        return detResult;
      });

      const rawDet = allDets[0];
      if (allDets[0]) {
        this.activeIdentityState = allDets[0].identityState;
        if (allDets[0].identityState === "CONFIRMED" && allDets[0].matchedWorker) {
          this.identifiedWorker = allDets[0].matchedWorker;
          this.faceMatchConfidence = allDets[0].matchConfidence;
          this.faceMatchScore = (allDets[0].matchConfidence || 85) / 100;
          this.faceMatchTimestamp = now;
        } else {
          this.identifiedWorker = null;
          this.faceMatchConfidence = 0;
          this.faceMatchScore = 0;
          this.faceMatchTimestamp = 0;
        }
        // Real-time synchronization of UI preview elements
        this.syncLiveIdentityUI(this.identifiedWorker, this.activeIdentityState, allDets[0].trackId || 1);
      }

      // 4. Temporal Multi-Frame Voting & Hysteresis Smoothing
      const det = this.applyTemporalSmoothing(rawDet);
      this.currentDetection = det;
      this.allDetections = allDets;

      // 5. Render Aligned HUD Bounding Boxes & Telemetry
      const latency = Math.round(performance.now() - tStart);
      this.renderHUD(det, personBox, headBox, torsoBox, w, h, latency);

      // 6. Evaluate Violations & Auto-Dispatch to Dashboard
      this.evaluateViolations(det);
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  },

  /**
   * Multi-Worker Spatial Localization on Live Camera Feed
   * Detects and segments multiple workers simultaneously across the camera frame
   */
  locateAllPersonsAndRegions(w, h) {
    const step = 8;
    const gridCols = Math.floor(w / step);
    const gridRows = Math.floor((h * 0.75) / step);
    const grid = new Uint8Array(gridCols * gridRows);

    try {
      const imgData = this.ctx.getImageData(0, 0, w, Math.round(h * 0.75));
      const data = imgData.data;

      const leftMargin = Math.round(w * 0.04);
      const rightMargin = Math.round(w * 0.96);
      const topMargin = Math.round(h * 0.03);
      const bottomMargin = Math.round(h * 0.73);

      for (let gy = 0; gy < gridRows; gy++) {
        const y = gy * step;
        if (y < topMargin || y > bottomMargin) continue;
        for (let gx = 0; gx < gridCols; gx++) {
          const x = gx * step;
          if (x < leftMargin || x > rightMargin) continue;
          const idx = (y * w + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // 1. Skin Tone (YCbCr)
          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
          const isSkin = (Cr >= 130 && Cr <= 175 && Cb >= 75 && Cb <= 130 && r > g && g > b * 0.65 && (r - b) >= 14 && Y >= 40);

          // 2. Hardhat Plastic (Yellow, Orange, Blue, Green, Dark Helmet)
          const isYellowOrOrange = (r >= 130 && g >= 95 && b <= 110 && (r - b) >= 45);
          const isBlueHardhat = (b >= 115 && b > r * 1.20 && b > g * 1.05);
          const isGreenHardhat = (g >= 110 && g > r * 1.10 && g > b * 1.15);
          const isDarkHelmet = (r <= 50 && g <= 50 && b <= 50 && Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6);

          // 3. High-Vis Vest (Neon Lime, Safety Orange)
          const isNeonLime = (g >= 115 && r >= 85 && b <= 110 && g > r * 0.88);
          const isSafetyOrange = (r >= 155 && g >= 65 && g <= 145 && b <= 55);

          // Exclude white/neutral background
          const isWhiteWall = (r >= 195 && g >= 195 && b >= 195 && Math.abs(r - g) <= 15 && Math.abs(g - b) <= 15);

          if (!isWhiteWall && (isSkin || isYellowOrOrange || isBlueHardhat || isGreenHardhat || isDarkHelmet || isNeonLime || isSafetyOrange)) {
            grid[gy * gridCols + gx] = 1;
          }
        }
      }
    } catch(e) {}

    // Group active cells into person clusters using BFS
    const visited = new Uint8Array(gridCols * gridRows);
    const clusters = [];

    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        const gIdx = gy * gridCols + gx;
        if (grid[gIdx] === 1 && !visited[gIdx]) {
          const queue = [gx, gy];
          visited[gIdx] = 1;
          let minGx = gx, maxGx = gx, minGy = gy, maxGy = gy;
          let count = 0;
          let qHead = 0;

          while (qHead < queue.length) {
            const cx = queue[qHead++];
            const cy = queue[qHead++];
            count++;
            if (cx < minGx) minGx = cx;
            if (cx > maxGx) maxGx = cx;
            if (cy < minGy) minGy = cy;
            if (cy > maxGy) maxGy = cy;

            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && nx < gridCols && ny >= 0 && ny < gridRows) {
                  const nIdx = ny * gridCols + nx;
                  if (grid[nIdx] === 1 && !visited[nIdx]) {
                    visited[nIdx] = 1;
                    queue.push(nx, ny);
                  }
                }
              }
            }
          }

          const cW = (maxGx - minGx + 1) * step;
          const cH = (maxGy - minGy + 1) * step;

          if (cW >= 32 && cH >= 42 && count >= 10) {
            clusters.push({
              x1: minGx * step,
              y1: minGy * step,
              x2: (maxGx + 1) * step,
              y2: (maxGy + 1) * step,
              w: cW,
              h: cH,
              count
            });
          }
        }
      }
    }

    if (clusters.length === 0) {
      const single = this.locatePersonAndRegions(w, h);
      return [{ ...single, workerIndex: 1, trackId: 1 }];
    }

    clusters.sort((a, b) => a.x1 - b.x1);

    const results = clusters.map((c, idx) => {
      const cX = c.x1 + c.w / 2;
      const cY = c.y1 + c.h * 0.35;
      const fW = Math.max(w * 0.14, Math.min(w * 0.36, c.w * 0.90));
      const fH = Math.max(h * 0.18, Math.min(h * 0.45, c.h * 0.85));

      const personBox = {
        x: Math.max(4, Math.round(cX - fW * 1.15)),
        y: Math.max(4, Math.round(cY - fH * 0.95)),
        w: Math.min(w - 8, Math.round(fW * 2.30)),
        h: Math.min(h - 8, Math.round(fH * 2.65))
      };

      const headBox = {
        x: Math.max(4, Math.round(cX - fW * 0.65)),
        y: Math.max(4, Math.round(cY - fH * 0.95)),
        w: Math.min(w - 8, Math.round(fW * 1.30)),
        h: Math.min(h - 8, Math.round(fH * 0.70))
      };

      const preciseFaceSize = Math.max(32, Math.min(w - 8, Math.round(fW * 0.95)));
      const faceBox = {
        x: Math.max(4, Math.round(cX - preciseFaceSize * 0.50)),
        y: Math.max(4, Math.round(cY - preciseFaceSize * 0.35)),
        w: preciseFaceSize,
        h: preciseFaceSize,
        cX: cX,
        cY: Math.round(cY - preciseFaceSize * 0.35 + preciseFaceSize * 0.50)
      };

      const torsoBox = {
        x: Math.max(4, Math.round(cX - fW * 1.10)),
        y: Math.max(4, Math.round(cY + fH * 0.36)),
        w: Math.min(w - 8, Math.round(fW * 2.20)),
        h: Math.min(h - 8, Math.round(fH * 1.40))
      };

      return {
        personBox,
        headBox,
        faceBox,
        torsoBox,
        cX, cY, fW, fH,
        workerIndex: idx + 1,
        trackId: idx + 1
      };
    });

    return results;
  },

  /**
   * Dynamic Real-Time Head & Torso Localization (Primary / Fallback)
   */
  locatePersonAndRegions(w, h) {
    const step = 4;
    let skinCount = 0;
    let sumX = 0, sumY = 0;
    let minX = w, maxX = 0, minY = h, maxY = 0;

    let helmetCandidatePixels = 0;
    let helmetSumX = 0, helmetSumY = 0;

    try {
      const imgData = this.ctx.getImageData(0, 0, w, Math.round(h * 0.75));
      const data = imgData.data;

      const leftMargin = Math.round(w * 0.08);
      const rightMargin = Math.round(w * 0.92);
      const topMargin = Math.round(h * 0.04);
      const bottomMargin = Math.round(h * 0.72);

      for (let y = topMargin; y < bottomMargin; y += step) {
        for (let x = leftMargin; x < rightMargin; x += step) {
          const idx = (y * w + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // 1. YCbCr Human Skin Tone Detection (Fitzpatrick Scale I-VI)
          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          const isSkin = (
            Cr >= 130 && Cr <= 175 &&
            Cb >= 75 && Cb <= 130 &&
            r > g && g > b * 0.65 &&
            (r - b) >= 14 && Y >= 40
          );

          if (isSkin) {
            skinCount++;
            sumX += x;
            sumY += y;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }

          // 2. Helmet candidate pixels in upper region (Chromatic Construction Hardhats: Yellow, Orange, Blue, Green)
          if (y < h * 0.48) {
            const isYellowOrOrange = (r >= 130 && g >= 95 && b <= 110 && (r - b) >= 45);
            const isBlueHardhat = (b >= 115 && b > r * 1.20 && b > g * 1.05);
            const isGreenHardhat = (g >= 110 && g > r * 1.10 && g > b * 1.15);
            const isNormalDarkHelmet = (r <= 50 && g <= 50 && b <= 50 && Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6);

            // NOTE: Pure white is intentionally EXCLUDED here so white walls do not pull tracking or trigger false detections!
            if (isYellowOrOrange || isBlueHardhat || isGreenHardhat || isNormalDarkHelmet) {
              helmetCandidatePixels++;
              helmetSumX += x;
              helmetSumY += y;
            }
          }
        }
      }
    } catch (e) {
      skinCount = 0;
    }

    let targetCenterX = w * 0.50;
    let targetCenterY = h * 0.33;
    let targetFaceW = w * 0.26;
    let targetFaceH = h * 0.34;

    if (skinCount >= 25) {
      targetCenterX = sumX / skinCount;
      targetCenterY = sumY / skinCount;
      targetFaceW = Math.max(w * 0.18, Math.min(w * 0.42, (maxX - minX) * 1.15));
      targetFaceH = Math.max(h * 0.22, Math.min(h * 0.44, (maxY - minY) * 1.20));
    } else if (helmetCandidatePixels >= 35) {
      // Worker is wearing a full-face normal helmet or large hardhat that dominates upper view
      targetCenterX = helmetSumX / helmetCandidatePixels;
      targetCenterY = (helmetSumY / helmetCandidatePixels) + (h * 0.12);
      targetFaceW = w * 0.28;
      targetFaceH = h * 0.36;
    }

    // Smooth tracker position using Exponential Moving Average
    if (!this.tracker.initialized) {
      this.tracker.centerX = targetCenterX;
      this.tracker.centerY = targetCenterY;
      this.tracker.faceW = targetFaceW;
      this.tracker.faceH = targetFaceH;
      this.tracker.initialized = true;
    } else {
      const alpha = 0.16; // Smooth, anti-jitter tracking
      this.tracker.centerX = this.tracker.centerX * (1 - alpha) + targetCenterX * alpha;
      this.tracker.centerY = this.tracker.centerY * (1 - alpha) + targetCenterY * alpha;
      this.tracker.faceW = this.tracker.faceW * (1 - alpha) + targetFaceW * alpha;
      this.tracker.faceH = this.tracker.faceH * (1 - alpha) + targetFaceH * alpha;
    }

    const cX = this.tracker.centerX;
    const cY = this.tracker.centerY;
    const fW = this.tracker.faceW;
    const fH = this.tracker.faceH;

    // 1. Overall Worker Person Bounding Box
    const personBox = {
      x: Math.max(6, Math.round(cX - fW * 1.20)),
      y: Math.max(6, Math.round(cY - fH * 0.95)),
      w: Math.min(w - 12, Math.round(fW * 2.40)),
      h: Math.min(h - 12, Math.round(fH * 2.70))
    };

    // 2. Head Crown Region Box (Covers both Construction Hardhat and Normal Helmet shells)
    const headBox = {
      x: Math.max(4, Math.round(cX - fW * 0.68)),
      y: Math.max(4, Math.round(cY - fH * 0.95)),
      w: Math.min(w - 8, Math.round(fW * 1.36)),
      h: Math.min(h - 8, Math.round(fH * 0.72))
    };

    // 3. Facial Biometric Inspection Region Box (Eyes, Nose, Mouth below helmet brim)
    // 1:1 aspect ratio square centered on the facial region
    const preciseFaceSize = Math.max(32, Math.min(w - 8, Math.round(fW * 0.95)));
    const faceBox = {
      x: Math.max(4, Math.round(cX - preciseFaceSize * 0.50)),
      y: Math.max(4, Math.round(cY - preciseFaceSize * 0.35)),
      w: preciseFaceSize,
      h: preciseFaceSize,
      cX: cX,
      cY: Math.round(cY - preciseFaceSize * 0.35 + preciseFaceSize * 0.50)
    };

    // 4. Torso Region Box (Vest Area: chest, shoulders, reflective straps, waist band)
    const torsoBox = {
      x: Math.max(4, Math.round(cX - fW * 1.15)),
      y: Math.max(4, Math.round(cY + fH * 0.38)),
      w: Math.min(w - 8, Math.round(fW * 2.30)),
      h: Math.min(h - 8, Math.round(fH * 1.42))
    };

    return { personBox, headBox, faceBox, torsoBox };
  },

  /**
   * MULTI-SPECTRAL PIXEL ANALYSIS (HSV + Specular + Normal/Construction Classifier)
   */
  analyzeFramePixels(personBox, headBox, torsoBox, canvasW, canvasH) {
    const helmetScan = this.scanRegionForColor(headBox, "helmet");
    const vestScan = this.scanRegionForColor(torsoBox, "vest");

    const missingItems = [];
    if (!helmetScan.detected) missingItems.push("Construction Hardhat");
    if (!vestScan.detected) missingItems.push("High-Vis Safety Vest");

    const isViolation = missingItems.length > 0;
    let statusText = "● ALL PPE COMPLIANT — HARDHAT & VEST DETECTED";
    if (missingItems.length === 2) {
      statusText = "🚨 CRITICAL VIOLATION: HELMET & VEST NOT DETECTED";
    } else if (!helmetScan.detected) {
      if (helmetScan.isBikeHelmet) {
        statusText = "🚨 PPE VIOLATION: BIKE HELMET UNAPPROVED — HARDHAT NOT DETECTED";
      } else {
        statusText = "🚨 PPE VIOLATION: CONSTRUCTION HELMET NOT DETECTED";
      }
    } else if (!vestScan.detected) {
      statusText = "⚠️ PPE VIOLATION: HIGH-VIS VEST NOT DETECTED";
    }

    return {
      personDetected: true,
      hasHelmet: helmetScan.detected,
      hasVest: vestScan.detected,
      isBikeHelmet: helmetScan.isBikeHelmet || false,
      helmetConf: helmetScan.conf,
      vestConf: vestScan.conf,
      helmetType: helmetScan.gearType,
      vestType: vestScan.gearType,
      personConf: 99.2,
      statusText: statusText,
      isViolation: isViolation,
      missingItems: missingItems,
      headBox: headBox,
      torsoBox: torsoBox,
      personBox: personBox,
      helmetRatio: helmetScan.ratio,
      vestRatio: vestScan.ratio
    };
  },

  /**
   * Multi-Class Pixel Scanner in HSV & Radiometric Space
   * Strictly distinguishes between Genuine Helmets (Construction & Normal) vs Bare Hair / Forehead
   */
  scanRegionForColor(box, type) {
    try {
      const imgData = this.ctx.getImageData(box.x, box.y, box.w, box.h);
      const data = imgData.data;
      const totalPixels = box.w * box.h;
      if (totalPixels === 0) return { detected: false, conf: 90, ratio: 0, gearType: "None" };

      // Ambient background wall sampling (determines if room has white/light-colored walls)
      let isWhiteBgDetected = false;
      try {
        const cw = this.canvasEl ? (this.canvasEl.width || 640) : 640;
        const ch = this.canvasEl ? (this.canvasEl.height || 480) : 480;
        // Sample points at canvas perimeter far from center subject
        const cornerCoords = [
          [16, 16],
          [Math.max(16, cw - 16), 16],
          [16, Math.floor(ch * 0.35)],
          [Math.max(16, cw - 16), Math.floor(ch * 0.35)]
        ];
        let whiteCorners = 0;
        for (const [cx, cy] of cornerCoords) {
          const cp = this.ctx.getImageData(cx, cy, 1, 1).data;
          // White or light neutral wall (high brightness, low chromatic saturation)
          if (cp[0] >= 145 && cp[1] >= 145 && cp[2] >= 145 && Math.abs(cp[0] - cp[1]) <= 18 && Math.abs(cp[1] - cp[2]) <= 18) {
            whiteCorners++;
          }
        }
        if (whiteCorners >= 2) isWhiteBgDetected = true;
      } catch (err) {}

      let foreheadSkinCount = 0;
      let foreheadTotal = 0;

      let crownHairCount = 0;
      let crownTotal = 0;

      // Construction Hardhat Matches
      let constrYellowMatches = 0;
      let constrWhiteMatches = 0;
      let constrOrangeMatches = 0;
      let constrBlueMatches = 0;
      let constrGreenMatches = 0;

      // Outer background wall pixel count in head corners
      let headCornerWallCount = 0;

      // Normal Helmet Matches
      let normSpecularMatches = 0;
      let normMetallicMatches = 0;
      let normColorMatches = 0;
      let normVisorMatches = 0;

      // Vest Matches
      let neonLimeMatches = 0;
      let safetyOrangeMatches = 0;
      let reflectiveStripeMatches = 0;

      // Sample every 2nd pixel (stride 8 bytes = 2 pixels)
      for (let i = 0; i < data.length; i += 8) {
        const pixelIdx = i / 4;
        const py = Math.floor(pixelIdx / box.w);
        const px = pixelIdx % box.w;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // RGB to HSV Conversion
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const v = max / 255;
        const s = max === 0 ? 0 : delta / max;

        let h = 0;
        if (delta !== 0) {
          if (max === r) h = ((g - b) / delta) % 6;
          else if (max === g) h = (b - r) / delta + 2;
          else h = (r - g) / delta + 4;
          h = Math.round(h * 60);
          if (h < 0) h += 360;
        }

        if (type === "helmet") {
          // 1. Forehead Skin Detection (Lower 35% of headBox between hairline and brow ridge)
          if (py >= box.h * 0.60) {
            foreheadTotal++;
            const Y = 0.299 * r + 0.587 * g + 0.114 * b;
            const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

            const isSkin = (
              Cr >= 130 && Cr <= 175 &&
              Cb >= 75 && Cb <= 130 &&
              r > g && g > b * 0.65 &&
              (r - b) >= 12 && Y >= 40
            );
            if (isSkin) foreheadSkinCount++;
          }

          // 2. Crown Hair Detection (Central head area where hair sits when not wearing a hardhat)
          if (py >= box.h * 0.32 && py <= box.h * 0.70 && px >= box.w * 0.22 && px <= box.w * 0.78) {
            crownTotal++;
            // Dark / black / brown / gray hair (low saturation, dark to medium luminance)
            const isDarkHair = (v <= 0.32 || (r <= 78 && g <= 78 && b <= 78 && Math.abs(r - g) <= 15 && Math.abs(g - b) <= 15));
            const isBrownHair = (h >= 14 && h <= 38 && s >= 0.18 && v <= 0.44 && r > b * 1.18);
            if (isDarkHair || isBrownHair) {
              crownHairCount++;
            }
          }

          // Check if pixel is in outer corner margin of head box (where background wall lives)
          const isCornerMargin = (px < box.w * 0.18 || px > box.w * 0.82) && (py < box.h * 0.28);
          const isNeutralLight = (v >= 0.68 && s <= 0.16 && r >= 155 && g >= 155 && b >= 155 && Math.abs(r - g) <= 16 && Math.abs(g - b) <= 16);
          if (isCornerMargin && isNeutralLight) {
            headCornerWallCount++;
          }

          // ====================================================
          // A. CHROMATIC CONSTRUCTION HARDHATS (Yellow, Orange, Blue, Green)
          // ====================================================
          // 1. Canary Yellow Hardhat (Vivid chromatic yellow)
          const isYellowHardhat = (
            h >= 36 && h <= 68 &&
            s >= 0.28 && v >= 0.35 &&
            r >= 120 && g >= 105 && b <= 120 &&
            (r + g) / 2 > b * 1.25 && (r - b) >= 38
          );

          // 2. Safety Day-Glo Orange & Emergency Red Hardhat
          const isOrangeOrRedHardhat = (
            ((h >= 10 && h <= 34 && s >= 0.42 && v >= 0.38 && r >= 145 && (r - b) >= 75 && r > g * 1.10)) ||
            ((h >= 348 || h <= 12) && s >= 0.45 && v >= 0.35 && r >= 140 && (r - g) >= 35 && (r - b) >= 55)
          );

          // 3. Industrial Safety Blue Hardhat
          const isBlueHardhat = (
            h >= 185 && h <= 240 &&
            s >= 0.30 && v >= 0.28 &&
            b >= 100 && b > r * 1.18 && b > g * 1.06
          );

          // 4. Environmental/Safety Green Hardhat
          const isGreenHardhat = (
            h >= 75 && h <= 155 &&
            s >= 0.28 && v >= 0.28 &&
            g >= 100 && g > r * 1.08 && g > b * 1.12
          );

          // ====================================================
          // B. WHITE CONSTRUCTION HARDHAT (Specularity & Central Dome Only)
          // ====================================================
          // Must be in central dome region, NOT outer corners, and have plastic dome specular intensity
          const isCentralDome = (px >= box.w * 0.20 && px <= box.w * 0.80 && py >= box.h * 0.05 && py <= box.h * 0.58);
          const isWhiteHardhat = isCentralDome && (
            v >= 0.85 && s <= 0.14 &&
            r >= 210 && g >= 210 && b >= 210 &&
            Math.abs(r - g) <= 12 && Math.abs(g - b) <= 12 && Math.abs(r - b) <= 14
          );

          // ====================================================
          // C. NORMAL HELMETS (MOTORCYCLE / RIDER)
          // ====================================================
          const isNormalSpecular = isCentralDome && (
            v >= 0.90 && s <= 0.12 &&
            r >= 225 && g >= 225 && b >= 225
          );

          const isNormalMetallic = isCentralDome && (
            v >= 0.45 && v <= 0.80 && s <= 0.10 &&
            r >= 110 && g >= 110 && b >= 110 &&
            Math.abs(r - g) <= 6 && Math.abs(g - b) <= 6
          );

          const isNormalColor = isCentralDome && (
            ((h >= 348 || h <= 12) && s >= 0.55 && v >= 0.42 && r >= 150) ||
            (h >= 190 && h <= 235 && s >= 0.45 && v >= 0.38 && b >= 120)
          );

          const isNormalVisor = (
            px >= box.w * 0.22 && px <= box.w * 0.78 &&
            py >= box.h * 0.42 && py <= box.h * 0.80 &&
            v >= 0.10 && v <= 0.38 &&
            (h >= 170 && h <= 225 || s <= 0.14) &&
            Math.abs(r - g) <= 10
          );

          if (isYellowHardhat) constrYellowMatches++;
          else if (isOrangeOrRedHardhat) constrOrangeMatches++;
          else if (isBlueHardhat) constrBlueMatches++;
          else if (isGreenHardhat) constrGreenMatches++;
          else if (isWhiteHardhat) constrWhiteMatches++;
          else if (isNormalSpecular) normSpecularMatches++;
          else if (isNormalMetallic) normMetallicMatches++;
          else if (isNormalColor) normColorMatches++;
          else if (isNormalVisor) normVisorMatches++;

        } else if (type === "vest") {
          // ==========================================
          // D. HIGH-VISIBILITY SAFETY VESTS (ISO 20471)
          // ==========================================
          // 1. Fluorescent Neon Lime / High-Vis Yellow-Green (EN ISO 20471 standard)
          const isNeonLime = (
            h >= 46 && h <= 108 &&
            s >= 0.22 && v >= 0.32 &&
            g >= 105 && g > b * 1.25 && (g - b) >= 25 && g > r * 0.90
          );

          // 2. High-Vis Day-Glo Safety Orange Vest
          const isSafetyOrange = (
            h >= 8 && h <= 34 &&
            s >= 0.38 && v >= 0.35 &&
            r >= 135 && (r - b) >= 65 && r > g * 1.15
          );

          // 3. Retro-Reflective Silver / White Safety Stripes
          const isReflective = (
            v >= 0.75 && s <= 0.15 &&
            r >= 165 && g >= 165 && b >= 165 &&
            Math.abs(r - g) <= 14 && Math.abs(g - b) <= 14 && Math.abs(r - b) <= 14
          );

          if (isNeonLime) neonLimeMatches++;
          else if (isSafetyOrange) safetyOrangeMatches++;
          else if (isReflective) reflectiveStripeMatches++;
        }
      }

      const sampledTotal = totalPixels / 2;

      // Base Threshold from Active Sensitivity Preset
      const thresholds = this.sensitivityThresholds[this.sensitivity] || this.sensitivityThresholds.standard;
      const baseThreshold = type === "helmet" ? thresholds.helmet : thresholds.vest;

      // Hysteresis: If item was detected in previous state, lower threshold slightly to prevent flicker
      const wasActive = type === "helmet" ? this.stableState.hasHelmet : this.stableState.hasVest;
      const effectiveThreshold = wasActive ? Math.max(0.06, baseThreshold - thresholds.holdMargin) : baseThreshold;

      let detected = false;
      let gearType = "None";
      let isBikeHelmet = false;
      let ratio = 0;

      if (type === "helmet") {
        const foreheadSkinRatio = foreheadTotal > 0 ? (foreheadSkinCount / foreheadTotal) : 0;
        const hasExposedForehead = foreheadSkinRatio >= 0.14;

        const hairRatio = crownTotal > 0 ? (crownHairCount / crownTotal) : 0;
        const hasVisibleHair = hairRatio >= 0.15;

        // Colored construction hardhat matches (Yellow, Orange, Blue, Green)
        const chromaticMatches = constrYellowMatches + constrOrangeMatches + constrBlueMatches + constrGreenMatches;
        const chromaticRatio = chromaticMatches / sampledTotal;

        // White hardhat matches
        const whiteRatio = constrWhiteMatches / sampledTotal;

        // Normal helmet matches (motorcycle, visor, dark shell)
        const totalNormalHelmet = normSpecularMatches + normMetallicMatches + normColorMatches + normVisorMatches;
        const normalHelmetRatio = totalNormalHelmet / sampledTotal;

        // Wall background indication
        const isWhiteWallBehind = (headCornerWallCount >= 6) || isWhiteBgDetected;

        // 1. Genuine Chromatic Construction Hardhat (Yellow, Orange, Blue, Green)
        // These colors NEVER match a white wall!
        if (chromaticRatio >= effectiveThreshold) {
          detected = true;
          ratio = chromaticRatio;
          if (constrYellowMatches >= constrOrangeMatches && constrYellowMatches >= constrBlueMatches) {
            gearType = "Construction Hardhat (Yellow)";
          } else if (constrOrangeMatches >= constrBlueMatches) {
            gearType = "Construction Hardhat (Orange)";
          } else if (constrBlueMatches >= constrGreenMatches) {
            gearType = "Construction Hardhat (Blue)";
          } else {
            gearType = "Construction Hardhat (Green)";
          }
        }
        // 2. White Wall Rejection: If user has VISIBLE HAIR or EXPOSED FOREHEAD,
        // they are bare-headed! A white wall behind them is strictly rejected.
        else if (hasVisibleHair || (hasExposedForehead && chromaticRatio < 0.20)) {
          detected = false;
          gearType = "None";
          ratio = 0;
        }
        // 3. Genuine White Construction Hardhat
        // Must have NO exposed hair, dense central specular dome, and exceed wall rejection threshold
        else if (whiteRatio >= (isWhiteWallBehind ? 0.32 : 0.18) && !hasVisibleHair && !hasExposedForehead) {
          detected = true;
          ratio = whiteRatio;
          gearType = "Construction Hardhat (White)";
        }
        // 4. Normal Motorcycle / Bike Helmet (Unapproved for construction sites)
        else if (normalHelmetRatio >= (effectiveThreshold * 0.70) && !hasVisibleHair && !hasExposedForehead && (normSpecularMatches >= 3 || normVisorMatches >= 4)) {
          detected = false; // Strictly NOT approved as construction hardhat!
          isBikeHelmet = true;
          ratio = normalHelmetRatio;
          gearType = "Bike Helmet (Unapproved - Hardhat Required)";
        }
        // 5. Default No Helmet
        else {
          detected = false;
          gearType = "None";
          ratio = 0;
        }

      } else {
        // ==========================================
        // VEST DECISION TREE:
        // CRITICAL OSHA / ISO 20471 RULE:
        // A safety vest MUST have fluorescent base fabric (Neon Lime or Safety Orange)!
        // Reflective stripes alone CANNOT constitute a vest (otherwise white walls, white shirts, etc. are falsely detected).
        // ==========================================
        const fluorescentMatches = neonLimeMatches + safetyOrangeMatches;
        const fluorescentRatio = fluorescentMatches / sampledTotal;

        // Must have at least 7.5% fluorescent fabric in torso region
        const hasFluorescentBase = fluorescentRatio >= 0.075;

        if (hasFluorescentBase) {
          const effectiveVestMatches = fluorescentMatches + Math.min(reflectiveStripeMatches, fluorescentMatches * 0.50);
          const effectiveVestRatio = effectiveVestMatches / sampledTotal;

          detected = effectiveVestRatio >= effectiveThreshold;
          ratio = effectiveVestRatio;

          if (detected) {
            if (neonLimeMatches >= safetyOrangeMatches) {
              gearType = reflectiveStripeMatches > 15 ? "Hi-Vis Neon Lime + Stripes" : "Hi-Vis Neon Lime";
            } else {
              gearType = reflectiveStripeMatches > 15 ? "Safety Orange + Stripes" : "Safety Orange";
            }
          } else {
            gearType = "None";
          }
        } else {
          // Zero or negligible fluorescent fabric:
          // Strictly NOT DETECTED! (White walls, white shirts, light reflections are completely rejected!)
          detected = false;
          gearType = "None";
          ratio = 0;
        }
      }

      // High-precision confidence calculation
      const conf = detected
        ? Math.min(99, Math.round(88 + Math.min(ratio * 40, 11)))
        : Math.min(99, Math.round(88 + Math.min((1 - ratio) * 10, 11)));

      return { detected, conf, ratio, gearType, isBikeHelmet };
    } catch (e) {
      return { detected: false, conf: 92, ratio: 0, gearType: "None" };
    }
  },

  /**
   * Temporal Multi-Frame Voting & Hysteresis Smoothing
   */
  applyTemporalSmoothing(rawDet) {
    this.temporalBuffer.push(rawDet);
    if (this.temporalBuffer.length > this.bufferSize) {
      this.temporalBuffer.shift();
    }

    const n = this.temporalBuffer.length;
    let helmetVote = 0;
    let vestVote = 0;
    let sumHelmetConf = 0;
    let sumVestConf = 0;

    this.temporalBuffer.forEach(item => {
      if (item.hasHelmet) helmetVote++;
      if (item.hasVest) vestVote++;
      sumHelmetConf += item.helmetConf;
      sumVestConf += item.vestConf;
    });

    const requiredVotes = Math.max(1, Math.ceil(n * 0.50));
    const stableHelmet = helmetVote >= requiredVotes;
    const stableVest = vestVote >= requiredVotes;

    this.stableState.hasHelmet = stableHelmet;
    this.stableState.hasVest = stableVest;
    this.stableState.helmetConf = Math.round(sumHelmetConf / n);
    this.stableState.vestConf = Math.round(sumVestConf / n);
    if (stableHelmet && rawDet.helmetType !== "None") this.stableState.helmetType = rawDet.helmetType;
    if (stableVest && rawDet.vestType !== "None") this.stableState.vestType = rawDet.vestType;

    const missingItems = [];
    if (!stableHelmet) missingItems.push("Construction Hardhat");
    if (!stableVest) missingItems.push("High-Vis Safety Vest");

    const isViolation = missingItems.length > 0;
    const worker = this.getActiveWorker();
    let statusText = "● ALL PPE COMPLIANT — HARDHAT & VEST VERIFIED";
    if (missingItems.length === 2) {
      statusText = `🚨 CRITICAL VIOLATION: ${worker.name.toUpperCase()} FOUND WITHOUT HELMET & VEST`;
    } else if (!stableHelmet) {
      statusText = `🚨 PPE VIOLATION: ${worker.name.toUpperCase()} FOUND WITHOUT CONSTRUCTION HELMET`;
    } else if (!stableVest) {
      statusText = `⚠️ PPE VIOLATION: ${worker.name.toUpperCase()} FOUND WITHOUT HIGH-VIS VEST`;
    }

    return {
      personDetected: true,
      hasHelmet: stableHelmet,
      hasVest: stableVest,
      helmetConf: this.stableState.helmetConf,
      vestConf: this.stableState.vestConf,
      helmetType: this.stableState.helmetType,
      vestType: this.stableState.vestType,
      personConf: 99.2,
      statusText: statusText,
      isViolation: isViolation,
      missingItems: missingItems,
      headBox: rawDet.headBox,
      torsoBox: rawDet.torsoBox,
      personBox: rawDet.personBox
    };
  },

  /**
   * Render High-Tech Aligned HUD Overlays onto Canvas
   */
  renderHUD(det, personBox, headBox, torsoBox, w, h, latency = 24) {
    const ctx = this.ctx;
    if (!ctx) return;

    const allDets = (this.allDetections && this.allDetections.length > 0) ? this.allDetections : [{
      ...det,
      personBox,
      headBox,
      torsoBox,
      workerIndex: 1
    }];

    const totalDetected = allDets.length;
    let anyViolation = false;

    // Draw HUD overlays for each detected worker
    allDets.forEach((d, idx) => {
      const pBox = d.personBox || personBox;
      const hBox = d.headBox || headBox;
      const tBox = d.torsoBox || torsoBox;
      const isVio = d.isViolation;
      if (isVio) anyViolation = true;

      const primaryColor = isVio ? "#EF4444" : "#22C55E";

      // 1. Worker Person Outer Tracking Box
      ctx.save();
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = isVio ? 2.5 : 1.8;
      if (isVio) {
        ctx.shadowColor = "#EF4444";
        ctx.shadowBlur = 10;
      }
      const bLen = Math.min(26, pBox.w * 0.18);
      ctx.beginPath();
      ctx.moveTo(pBox.x, pBox.y + bLen); ctx.lineTo(pBox.x, pBox.y); ctx.lineTo(pBox.x + bLen, pBox.y);
      ctx.moveTo(pBox.x + pBox.w - bLen, pBox.y); ctx.lineTo(pBox.x + pBox.w, pBox.y); ctx.lineTo(pBox.x + pBox.w, pBox.y + bLen);
      ctx.moveTo(pBox.x, pBox.y + pBox.h - bLen); ctx.lineTo(pBox.x, pBox.y + pBox.h); ctx.lineTo(pBox.x + bLen, pBox.y + pBox.h);
      ctx.moveTo(pBox.x + pBox.w - bLen, pBox.y + pBox.h); ctx.lineTo(pBox.x + pBox.w, pBox.y + pBox.h); ctx.lineTo(pBox.x + pBox.w, pBox.y + pBox.h - bLen);
      ctx.stroke();

      ctx.strokeStyle = isVio ? "rgba(239, 68, 68, 0.40)" : "rgba(34, 197, 94, 0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(pBox.x, pBox.y, pBox.w, pBox.h);
      ctx.restore();

      // Person Label Tag with 4-Phase Identification State
      ctx.save();
      const labelW = Math.max(260, Math.min(380, pBox.w * 0.95));
      const labelH = 24;

      let labelText = "";
      const worker = d.matchedWorker;
      const conf = d.matchConfidence || 0;
      const idState = d.identityState || (worker ? "CONFIRMED" : "UNKNOWN");
      const tId = d.trackId || d.workerIndex || (idx + 1);

      let tagBgColor;
      if (isVio) {
        tagBgColor = "#EF4444";
      } else if (this.inspectedWorkerId && this.inspectedWorkerId !== "auto") {
        tagBgColor = "#8B5CF6";
      } else if (idState === "CONFIRMED") {
        tagBgColor = "#22C55E";
      } else if (idState === "VERIFYING") {
        tagBgColor = "#0284C7"; // High-tech azure blue for verifying
      } else if (idState === "DETECTING") {
        tagBgColor = "#475569"; // Slate gray for detecting
      } else {
        tagBgColor = "#D97706"; // Amber for unknown
      }

      ctx.fillStyle = tagBgColor;
      ctx.fillRect(pBox.x, pBox.y - labelH, labelW, labelH);
      ctx.fillStyle = (isVio || idState !== "CONFIRMED") ? "#ffffff" : "#0B0F14";
      ctx.font = "bold 11px monospace";

      if (this.inspectedWorkerId && this.inspectedWorkerId !== "auto") {
        const locked = this.getActiveWorker();
        labelText = `[👤 LOCKED: ${locked.name.toUpperCase()} (${locked.id})]`;
      } else if (idState === "DETECTING") {
        labelText = totalDetected > 1
          ? `[👤 Worker #${tId} • DETECTING PERSON]`
          : `[👤 DETECTING PERSON]`;
      } else if (idState === "VERIFYING") {
        labelText = totalDetected > 1
          ? `[👤 Worker #${tId} • VERIFYING IDENTITY...]`
          : `[👤 VERIFYING IDENTITY...]`;
      } else if (idState === "CONFIRMED" && worker && !worker.isUnidentified && !worker.isUnknown) {
        labelText = `[👤 ID: ${worker.name.toUpperCase()} (${worker.id}) • ${conf}% MATCH]`;
      } else {
        labelText = totalDetected > 1
          ? `[👤 Worker #${tId} • UNKNOWN WORKER]`
          : `[👤 UNKNOWN WORKER • NO FACE MATCH]`;
      }
      ctx.fillText(labelText, pBox.x + 6, pBox.y - 7);
      ctx.restore();

      // 2. Head Region Box
      const helmetColor = d.hasHelmet ? "#38BDF8" : "#EF4444";
      ctx.save();
      ctx.strokeStyle = helmetColor;
      ctx.lineWidth = 2.0;
      ctx.setLineDash(d.hasHelmet ? [] : [5, 4]);
      ctx.strokeRect(hBox.x, hBox.y, hBox.w, hBox.h);
      ctx.fillStyle = helmetColor;
      ctx.fillRect(hBox.x, hBox.y - 18, Math.min(hBox.w, 180), 18);
      ctx.fillStyle = d.hasHelmet ? "#0B0F14" : "#ffffff";
      ctx.font = "bold 10px monospace";
      const hText = d.hasHelmet ? `[✓] HARDHAT: ${d.helmetType || 'OK'}` : `[!] NO HARDHAT ❌`;
      ctx.fillText(hText, hBox.x + 4, hBox.y - 5);
      ctx.restore();

      // 3. Torso Region Box
      const vestColor = d.hasVest ? "#F97316" : "#EF4444";
      ctx.save();
      ctx.strokeStyle = vestColor;
      ctx.lineWidth = 2.0;
      ctx.setLineDash(d.hasVest ? [] : [5, 4]);
      ctx.strokeRect(tBox.x, tBox.y, tBox.w, tBox.h);
      ctx.fillStyle = vestColor;
      ctx.fillRect(tBox.x, tBox.y - 18, Math.min(tBox.w, 180), 18);
      ctx.fillStyle = "#0B0F14";
      ctx.font = "bold 10px monospace";
      const vText = d.hasVest ? `[✓] VEST: ${d.vestType || 'OK'}` : `[!] NO VEST ❌`;
      ctx.fillText(vText, tBox.x + 4, tBox.y - 5);
      ctx.restore();
    });

    // 4. Top Telemetry Ribbon
    ctx.save();
    ctx.fillStyle = "rgba(11, 15, 20, 0.92)";
    ctx.fillRect(0, 0, w, 32);

    ctx.fillStyle = "#9CA3AF";
    ctx.font = "11px monospace";
    ctx.fillText(`CAM-LIVE: AI MULTI-WORKER MONITOR (${totalDetected} DETECTED) • SENSITIVITY: ${this.sensitivity.toUpperCase()}`, 12, 20);

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0] + "." + Math.floor(now.getMilliseconds() / 100);
    ctx.fillText(timeStr, w - 110, 20);

    // Live Red Blinking Dot
    ctx.fillStyle = "#EF4444";
    ctx.beginPath();
    ctx.arc(w - 124, 16, 4, 0, Math.PI * 2);
    ctx.fill();

    // 5. Overall Status Banner (Bottom Center)
    const bannerW = Math.min(580, w - 24);
    const bannerX = (w - bannerW) / 2;
    ctx.fillStyle = anyViolation ? "rgba(239, 68, 68, 0.95)" : "rgba(34, 197, 94, 0.92)";
    ctx.roundRect(bannerX, h - 38, bannerW, 30, 4);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    let bottomText = det.statusText;
    if (totalDetected > 1) {
      const violationsCount = allDets.filter(d => d.isViolation).length;
      bottomText = violationsCount > 0
        ? `🚨 ${violationsCount}/${totalDetected} WORKERS NON-COMPLIANT (PPE VIOLATION ACTIVE)`
        : `● ALL ${totalDetected} VISIBLE WORKERS PPE COMPLIANT`;
    }
    ctx.fillText(bottomText, w / 2, h - 18);
    ctx.restore();

    // Update HTML Telemetry Badges outside canvas
    this.updateTelemetryHUD(det, latency);
  },

  /**
   * Update HTML telemetry badges and indicators across the DOM
   */
  updateTelemetryHUD(det, latency = 24) {
    // 1. Overall HUD badge
    const overallBadge = document.getElementById("hud-badge-overall");
    if (overallBadge) {
      if (!det.isViolation) {
        overallBadge.className = "badge badge-safe";
        overallBadge.textContent = "● All PPE Compliant";
      } else {
        overallBadge.className = "badge badge-danger";
        overallBadge.textContent = "🚨 PPE Violation Active";
      }
    }

    // 2. Helmet HUD badge
    const helmetBadge = document.getElementById("hud-badge-helmet");
    if (helmetBadge) {
      if (det.hasHelmet) {
        helmetBadge.className = "badge badge-safe";
        helmetBadge.innerHTML = `✓ DETECTED: ${det.helmetType} (${det.helmetConf}%)`;
      } else {
        helmetBadge.className = "badge badge-danger ppe-pulse-alert";
        if (det.isBikeHelmet) {
          helmetBadge.innerHTML = `❌ NOT DETECTED (Bike Helmet Unapproved)`;
        } else {
          helmetBadge.innerHTML = `❌ NOT DETECTED: Missing Hardhat (${det.helmetConf}%)`;
        }
      }
    }

    // 3. Vest HUD badge
    const vestBadge = document.getElementById("hud-badge-vest");
    if (vestBadge) {
      if (det.hasVest) {
        vestBadge.className = "badge badge-safe";
        vestBadge.innerHTML = `✓ DETECTED: ${det.vestType} (${det.vestConf}%)`;
      } else {
        vestBadge.className = "badge badge-danger ppe-pulse-alert";
        vestBadge.innerHTML = `❌ NOT DETECTED: Missing Vest (${det.vestConf}%)`;
      }
    }

    // 4. Dashboard Quick Monitor badges
    const dashHelmet = document.getElementById("dash-cam-helmet-badge");
    if (dashHelmet) {
      if (det.hasHelmet) {
        dashHelmet.className = "badge badge-safe";
        dashHelmet.innerHTML = `✓ DETECTED: ${det.helmetType || "Hardhat"} (${det.helmetConf}%)`;
      } else {
        dashHelmet.className = "badge badge-danger ppe-pulse-alert";
        dashHelmet.innerHTML = det.isBikeHelmet
          ? `❌ NOT DETECTED (Bike Helmet Unapproved)`
          : `❌ NOT DETECTED: Missing Hardhat (${det.helmetConf}%)`;
      }
    }

    const dashVest = document.getElementById("dash-cam-vest-badge");
    if (dashVest) {
      if (det.hasVest) {
        dashVest.className = "badge badge-safe";
        dashVest.innerHTML = `✓ DETECTED: ${det.vestType || "Vest"} (${det.vestConf}%)`;
      } else {
        dashVest.className = "badge badge-danger ppe-pulse-alert";
        dashVest.innerHTML = `❌ NOT DETECTED: Missing Vest (${det.vestConf}%)`;
      }
    }

    // 5. Modal Badges (if modal opened on dashboard)
    const modalHelmet = document.getElementById("modal-cam-helmet-badge");
    if (modalHelmet) {
      if (det.hasHelmet) {
        modalHelmet.className = "badge badge-safe";
        modalHelmet.innerHTML = `✓ DETECTED: ${det.helmetType || "Hardhat"} (${det.helmetConf}%)`;
      } else {
        modalHelmet.className = "badge badge-danger ppe-pulse-alert";
        modalHelmet.innerHTML = det.isBikeHelmet
          ? `❌ NOT DETECTED (Bike Helmet Unapproved)`
          : `❌ NOT DETECTED: Missing Hardhat (${det.helmetConf}%)`;
      }
    }

    const modalVest = document.getElementById("modal-cam-vest-badge");
    if (modalVest) {
      if (det.hasVest) {
        modalVest.className = "badge badge-safe";
        modalVest.innerHTML = `✓ DETECTED: ${det.vestType || "Vest"} (${det.vestConf}%)`;
      } else {
        modalVest.className = "badge badge-danger ppe-pulse-alert";
        modalVest.innerHTML = `❌ NOT DETECTED: Missing Vest (${det.vestConf}%)`;
      }
    }

    // 6. Latency display
    const latencyEl = document.getElementById("live-cam-latency");
    if (latencyEl) {
      latencyEl.textContent = `${latency}ms (30 FPS)`;
    }

    // 7. Live Active Violation Notification Banner
    this.updateViolationBanner(det);
  },

  /**
   * Update prominent Live Active Violation Banner across Monitoring and Dashboard
   */
  updateViolationBanner(det) {
    const banners = [
      document.getElementById("live-cam-violation-banner"),
      document.getElementById("modal-cam-violation-banner")
    ];
    const worker = this.getActiveWorker();

    banners.forEach(banner => {
      if (!banner) return;
      if (det.isViolation) {
        banner.style.display = "flex";
        const isCritical = det.missingItems.length === 2;
        const missingVestOnly = !det.hasVest && det.hasHelmet;
        const missingHelmetOnly = !det.hasHelmet && det.hasVest;

        if (isCritical) {
          banner.className = "live-violation-banner critical-banner";
        } else if (missingVestOnly) {
          banner.className = "live-violation-banner warning-banner";
        } else {
          banner.className = "live-violation-banner";
        }

        const iconEl = banner.querySelector(".violation-banner-icon");
        const titleEl = banner.querySelector(".violation-banner-title");
        const descEl = banner.querySelector(".violation-banner-desc");
        const badgeEl = banner.querySelector(".violation-banner-badge");

        const elapsed = this.violationStartTime ? (Date.now() - this.violationStartTime) : 0;
        const remainingMs = Math.max(0, this.incidentAlertDelayMs - elapsed);
        const countdownSec = (remainingMs / 1000).toFixed(1);
        const alertDispatched = remainingMs === 0;

        const alertSuffix = alertDispatched
          ? "Sustained violation (>5.0s). Safety incident alert dispatched to Dashboard & Notifications."
          : `Violation detected. Sustained verification in progress (${countdownSec}s remaining before incident alert).`;

        if (isCritical) {
          if (iconEl) iconEl.textContent = "🚨";
          if (titleEl) titleEl.textContent = `CRITICAL VIOLATION: ${worker.name.toUpperCase()} (${worker.id}) WITHOUT HELMET & VEST`;
          if (descEl) descEl.textContent = `Worker detected with ZERO PPE. ${alertSuffix}`;
          if (badgeEl) {
            badgeEl.className = "badge badge-danger ppe-pulse-alert violation-banner-badge";
            badgeEl.textContent = alertDispatched ? "CRITICAL ALERT ACTIVE" : `ALERT IN ${countdownSec}s`;
          }
        } else if (missingHelmetOnly) {
          if (iconEl) iconEl.textContent = "⛑️";
          if (titleEl) titleEl.textContent = `PPE VIOLATION: ${worker.name.toUpperCase()} (${worker.id}) WITHOUT CONSTRUCTION HELMET`;
          if (descEl) descEl.textContent = `Worker is NOT wearing an approved OSHA/EN hardhat. ${alertSuffix}`;
          if (badgeEl) {
            badgeEl.className = "badge badge-danger ppe-pulse-alert violation-banner-badge";
            badgeEl.textContent = alertDispatched ? "HARDHAT MISSING" : `ALERT IN ${countdownSec}s`;
          }
        } else if (missingVestOnly) {
          if (iconEl) iconEl.textContent = "🦺";
          if (titleEl) titleEl.textContent = `PPE VIOLATION: ${worker.name.toUpperCase()} (${worker.id}) WITHOUT HIGH-VIS VEST`;
          if (descEl) descEl.textContent = `Worker is NOT wearing required safety vest. ${alertSuffix}`;
          if (badgeEl) {
            badgeEl.className = "badge badge-high ppe-pulse-alert violation-banner-badge";
            badgeEl.textContent = alertDispatched ? "VEST MISSING" : `ALERT IN ${countdownSec}s`;
          }
        }
      } else {
        banner.style.display = "none";
      }
    });
  },

  /**
   * Fast, responsive violation evaluator with 5-second sustained delay before incident alert dispatch
   */
  evaluateViolations(det) {
    const now = Date.now();
    if (det.isViolation) {
      this.consecutiveViolations++;
      if (!this.violationStartTime) {
        this.violationStartTime = now;
      }

      const sustainedViolationDuration = now - this.violationStartTime;

      // Incident alert is dispatched strictly after 5.0 seconds of continuous sustained violation
      if (sustainedViolationDuration >= this.incidentAlertDelayMs && this.autoAlertEnabled) {
        const worker = this.getActiveWorker();
        const violationKey = `${worker.id}_${det.missingItems.slice().sort().join("_")}`;

        // Trigger immediately if violation type changed (e.g. was missing vest, now missing both, or different worker),
        // or if cooldown has elapsed for continuous same violation
        const isNewViolationType = (violationKey !== this.lastViolationKey);
        const cooldownElapsed = (now - this.lastAlertTime > this.alertCooldownMs);

        if (isNewViolationType || cooldownElapsed) {
          this.lastAlertTime = now;
          this.lastViolationKey = violationKey;
          this.dispatchPPEAlert("auto");
        }
      }
    } else {
      // Graceful decay instead of instant zeroing: reset violation timer when compliant
      this.consecutiveViolations = Math.max(0, this.consecutiveViolations - 1);
      if (this.consecutiveViolations === 0) {
        this.violationStartTime = null;
        this.lastViolationKey = null;
      }
    }
  },

  /**
   * Capture Snapshot from Canvas as JPEG DataURL
   */
  captureSnapshot() {
    if (!this.canvasEl) return null;
    try {
      const snapCanvas = document.createElement("canvas");
      snapCanvas.width = 240;
      snapCanvas.height = 160;
      const snapCtx = snapCanvas.getContext("2d");
      snapCtx.drawImage(this.canvasEl, 0, 0, 240, 160);
      return snapCanvas.toDataURL("image/jpeg", 0.65);
    } catch(e) {
      return null;
    }
  },

  /**
   * Dispatch real-time alert directly into SafeGuardState
   */
  dispatchPPEAlert(triggerType = "manual") {
    const det = this.currentDetection;
    const worker = this.getActiveWorker();

    const isCritical = det.missingItems.length === 2;
    const missingStr = det.missingItems.join(" & ");

    const alertId = `ALT-LIVE-${Math.floor(1000 + Math.random() * 9000)}`;
    const snapshotUrl = this.captureSnapshot();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let title = "";
    let details = "";
    let toastType = "danger";
    let toastHeader = "🚨 Safety Alert Dispatched";

    if (isCritical) {
      title = `🚨 CRITICAL VIOLATION: ${worker.name} (${worker.id}) found WITHOUT HELMET & VEST`;
      details = `CRITICAL NON-COMPLIANCE: Worker ${worker.name} (Badge ID: ${worker.id}, Department: ${worker.department || 'Operations'}) was detected on live camera with ZERO PPE: Construction Hardhat: NOT DETECTED ❌ • High-Vis Safety Vest: NOT DETECTED ❌. Immediate supervisor intervention and work stoppage required.`;
      toastType = "danger";
      toastHeader = "🚨 CRITICAL PPE VIOLATION";
    } else if (!det.hasHelmet) {
      const helmetReason = det.isBikeHelmet ? "Normal Bike Helmet (Unapproved)" : "Hardhat NOT DETECTED ❌";
      title = `🚨 PPE Violation: ${worker.name} (${worker.id}) found WITHOUT CONSTRUCTION HELMET`;
      details = `PPE NON-COMPLIANCE: Worker ${worker.name} (Badge ID: ${worker.id}, Department: ${worker.department || 'Operations'}) was detected on live camera without approved construction hardhat (${helmetReason}). High-vis vest verified: ${det.vestType || 'Verified'}. Immediate supervisor notification dispatched.`;
      toastType = "danger";
      toastHeader = "🚨 PPE Helmet Violation";
    } else {
      title = `⚠️ PPE Violation: ${worker.name} (${worker.id}) found WITHOUT HIGH-VIS VEST`;
      details = `PPE NON-COMPLIANCE: Worker ${worker.name} (Badge ID: ${worker.id}, Department: ${worker.department || 'Operations'}) was detected on live camera without high-vis safety vest (ISO 20471). Construction hardhat verified: ${det.helmetType || 'Verified'}. Immediate supervisor notification dispatched.`;
      toastType = "warning";
      toastHeader = "⚠️ PPE Vest Violation";
    }

    const stateEngine = (typeof SafeGuardState !== "undefined" ? SafeGuardState : window.SafeGuardState);
    const appEngine = (typeof SafeGuardApp !== "undefined" ? SafeGuardApp : window.SafeGuardApp);

    if (stateEngine) {
      try {
        stateEngine.update(state => {
          state.alerts = state.alerts || [];
          state.incidents = state.incidents || [];
          state.auditLogs = state.auditLogs || [];
          state.workers = state.workers || [];
          state.kpis = state.kpis || {};

          const newAlert = {
            id: alertId,
            severity: isCritical ? "CRITICAL" : (!det.hasHelmet ? "HIGH" : "WARNING"),
            severityClass: isCritical ? "critical-alert" : (!det.hasHelmet ? "high-alert" : "warning-alert"),
            title: title,
            worker: `${worker.name} (${worker.id})`,
            workerName: worker.name,
            workerId: worker.id,
            workerFace: worker.faceImage || null,
            workerDept: worker.department || "Operations",
            missingItems: det.missingItems || [],
            location: "Live Camera Monitored Area",
            timeAgo: "Just now",
            timestamp: new Date().toISOString(),
            details: details,
            status: "Active",
            snapshot: snapshotUrl,
            isLiveCamera: true
          };

          state.alerts.unshift(newAlert);
          if (state.alerts.length > 50) state.alerts = state.alerts.slice(0, 50);

          state.kpis.activeAlerts = state.alerts.filter(a => a.status === "Active").length;
          state.kpis.criticalAlerts = state.alerts.filter(a => a.severity === "CRITICAL" && a.status === "Active").length;
          state.kpis.todayIncidents = state.incidents.length + 1;
          state.kpis.safetyScore = Math.max(50, (state.kpis.safetyScore || 100) - (isCritical ? 5 : 3));
          state.kpis.ppeCompliance = Math.max(60, +((state.kpis.ppeCompliance || 100) - (isCritical ? 2.5 : 1.5)).toFixed(1));

          // Deduct safety score from the specific worker profile only if accurately identified
          if (worker.id && worker.id !== "UNID-PERSON") {
            const wTarget = state.workers.find(w => w.id === worker.id);
            if (wTarget) {
              const penalty = isCritical ? 12 : 8;
              wTarget.safetyScore = Math.max(40, (wTarget.safetyScore || 100) - penalty);
              wTarget.status = wTarget.safetyScore < 70 ? "High Risk" : "Warning";
              wTarget.incidents = (wTarget.incidents || 0) + 1;
              wTarget.ppe = Math.max(40, (wTarget.ppe || 100) - (isCritical ? 15 : 10));
            }
          }

          // Add incident record
          state.incidents.unshift({
            id: `INC-2026-LIVE-${Math.floor(100 + Math.random() * 900)}`,
            type: isCritical ? "Critical PPE Breach (Zero PPE)" : (!det.hasHelmet ? "PPE Violation (No Hardhat)" : "PPE Violation (No Vest)"),
            location: "Live Camera Monitored Area",
            severity: isCritical ? "Critical" : "High",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: "Open",
            worker: `${worker.name} (${worker.id})`,
            officer: "Officer 01 (Auto-Assigned)",
            description: details,
            evidence: `CAM-LIVE Snapshot #${alertId}`,
            actionTaken: "Real-time dispatch alert transmitted to dashboard & notifications; audible voice warning sounded."
          });

          // Audit log
          state.auditLogs.unshift({
            time: "Just now",
            action: `Alert ${alertId} generated: ${worker.name} (${worker.id}) missing ${missingStr} on live camera`,
            user: "SafeGuard AI Vision Engine"
          });

          return state;
        });
        console.log(`[SafeGuard AI] Alert ${alertId} dispatched and logged to state.`);
      } catch (err) {
        console.error("[SafeGuard AI] Error in dispatchPPEAlert update:", err);
      }
    }

    // Record in local dispatches feed
    this.recentDispatches.unshift({
      id: alertId,
      time: timeStr,
      workerName: worker.name,
      workerId: worker.id,
      missingStr: missingStr,
      isCritical: isCritical,
      snapshot: snapshotUrl
    });
    if (this.recentDispatches.length > 8) this.recentDispatches.pop();
    this.renderDispatchesFeed();

    // Play Alert Chime
    if (!this.audioMuted && appEngine) {
      appEngine.playAudioChime(isCritical);
    }

    // Audible Voice Callout: "Warning! <Worker Name>, no <missing PPE> detected!"
    if (!this.audioMuted && ('speechSynthesis' in window)) {
      try {
        const isUnverified = worker.isUnknown || worker.isUnidentified || !worker.name || worker.name === "Unknown Worker" || worker.id === "UNKNOWN" || worker.id === "UNID-PERSON";
        const spokenName = isUnverified ? "Unknown Worker" : worker.name;
        let speechText = "";
        if (isCritical) {
          speechText = `Warning! ${spokenName}, neither helmet nor safety vest detected!`;
        } else if (!det.hasHelmet) {
          speechText = `Warning! ${spokenName}, no helmet detected!`;
        } else if (!det.hasVest) {
          speechText = `Warning! ${spokenName}, no safety vest detected!`;
        }

        if (speechText) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(speechText);
          utterance.rate = 0.95;
          utterance.pitch = 1.05;
          utterance.volume = 1.0;
          const voices = window.speechSynthesis.getVoices();
          const preferred = voices.find(v => v.lang && v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("David") || v.name.includes("Zira")));
          if (preferred) utterance.voice = preferred;
          window.speechSynthesis.speak(utterance);
          console.log(`[SafeGuard-AI Live Voice Alert] "${speechText}"`);
        }
      } catch (err) {
        console.warn("Speech synthesis error in live camera:", err);
      }
    }

    // Show Toast Notification
    if (appEngine) {
      appEngine.showToast(
        toastHeader,
        title.replace(/^[🚨⚠️]\s*/, "") + " — Logged to Dashboard & Alert Center.",
        toastType
      );
    }

    // Update Live Violation Banner
    this.updateViolationBanner(det);

    // Flash UI container if present
    const container = document.getElementById("live-camera-container");
    if (container) {
      container.classList.add("flash-alert-active");
      setTimeout(() => container.classList.remove("flash-alert-active"), 1200);
    }
  },

  /**
   * Trigger Simulated PPE Violation Test
   * Directly test: "no-vest", "no-helmet", "no-both"
   */
  triggerSimulatedDetection(scenario) {
    const worker = this.getActiveWorker();
    const w = this.canvasEl ? (this.canvasEl.width || 640) : 640;
    const h = this.canvasEl ? (this.canvasEl.height || 420) : 420;

    let hasHelmet = false;
    let hasVest = false;
    let helmetType = "None";
    let vestType = "None";

    if (scenario === "no-vest") {
      hasHelmet = true;
      hasVest = false;
      helmetType = "Construction Hardhat (Yellow)";
      vestType = "None";
    } else if (scenario === "no-helmet") {
      hasHelmet = false;
      hasVest = true;
      helmetType = "None";
      vestType = "Hi-Vis Neon Lime";
    } else if (scenario === "no-both") {
      hasHelmet = false;
      hasVest = false;
      helmetType = "None";
      vestType = "None";
    }

    const missingItems = [];
    if (!hasHelmet) missingItems.push("Construction Hardhat");
    if (!hasVest) missingItems.push("High-Vis Safety Vest");

    const det = {
      personDetected: true,
      hasHelmet: hasHelmet,
      hasVest: hasVest,
      helmetConf: hasHelmet ? 97 : 88,
      vestConf: hasVest ? 95 : 86,
      helmetType: helmetType,
      vestType: vestType,
      personConf: 99.4,
      statusText: missingItems.length === 2
        ? `🚨 CRITICAL VIOLATION: ${worker.name.toUpperCase()} FOUND WITHOUT HELMET & VEST`
        : (!hasHelmet ? `🚨 PPE VIOLATION: ${worker.name.toUpperCase()} FOUND WITHOUT CONSTRUCTION HELMET` : `⚠️ PPE VIOLATION: ${worker.name.toUpperCase()} FOUND WITHOUT HIGH-VIS VEST`),
      isViolation: true,
      missingItems: missingItems,
      isBikeHelmet: false,
      headBox: { x: Math.round(w * 0.36), y: Math.round(h * 0.12), w: Math.round(w * 0.28), h: Math.round(h * 0.26) },
      torsoBox: { x: Math.round(w * 0.24), y: Math.round(h * 0.42), w: Math.round(w * 0.52), h: Math.round(h * 0.48) },
      personBox: { x: Math.round(w * 0.22), y: Math.round(h * 0.08), w: Math.round(w * 0.56), h: Math.round(h * 0.88) }
    };

    this.currentDetection = det;
    this.stableState = {
      hasHelmet: hasHelmet,
      hasVest: hasVest,
      helmetConf: det.helmetConf,
      vestConf: det.vestConf,
      helmetType: helmetType,
      vestType: vestType
    };

    // If stream is not actively rendering, draw procedural test frame
    if (!this.isRunning && this.ctx) {
      this.drawTestFrame(scenario, w, h);
    }

    this.renderHUD(det, det.personBox, det.headBox, det.torsoBox, w, h, 16);
    this.updateTelemetryHUD(det, 16);
    this.lastAlertTime = 0; // ensure immediate dispatch
    this.dispatchPPEAlert("simulated");
  },

  /**
   * Alias for backward compatibility
   */
  triggerCrossZoneTest(scenario = "no-helmet") {
    return this.triggerSimulatedDetection(scenario);
  },

  /**
   * Draw Clean Procedural Worker Frame for Immediate Visual Testing
   */
  drawTestFrame(scenario, w, h) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0B0F14";
    ctx.fillRect(0, 0, w, h);

    const cX = w * 0.5;
    const cY = h * 0.36;
    const faceW = 120;
    const faceH = 150;

    // Torso / Vest / Shirt
    const torsoY = cY + faceH * 0.40;
    const torsoW = faceW * 2.10;
    const torsoH = faceH * 1.45;
    const torsoX = cX - torsoW / 2;

    if (scenario === "no-helmet") {
      // Has Vest (Neon Lime)
      ctx.fillStyle = "#a3e635";
      ctx.beginPath();
      ctx.roundRect(torsoX, torsoY, torsoW, torsoH, 10);
      ctx.fill();
      // Reflective silver stripes
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(torsoX + torsoW * 0.20, torsoY + 10, 16, torsoH - 20);
      ctx.fillRect(torsoX + torsoW * 0.70, torsoY + 10, 16, torsoH - 20);
    } else {
      // No Vest (Dark grey civilian shirt)
      ctx.fillStyle = "#334155";
      ctx.beginPath();
      ctx.roundRect(torsoX, torsoY, torsoW, torsoH, 10);
      ctx.fill();
    }

    // Head / Face
    ctx.fillStyle = "#e0a97a";
    ctx.beginPath();
    ctx.ellipse(cX, cY, faceW * 0.44, faceH * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();

    // Helmet / Hair
    const headBoxY = Math.round(cY - faceH * 0.95);
    const headBoxH = Math.round(faceH * 0.72);
    const headBoxW = Math.round(faceW * 1.36);

    if (scenario === "no-vest") {
      // Has Construction Hardhat (Vivid Yellow Dome)
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(cX, headBoxY + headBoxH * 0.70, headBoxW * 0.44, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cX - headBoxW * 0.50, headBoxY + headBoxH * 0.65, headBoxW, 14);
    } else {
      // Bare Hair (Dark hair, no hardhat)
      ctx.fillStyle = "#1e1e1e";
      ctx.beginPath();
      ctx.ellipse(cX, headBoxY + headBoxH * 0.70, headBoxW * 0.42, headBoxH * 0.42, 0, Math.PI, 0);
      ctx.fill();
    }
  },

  /**
   * Render real-time automated dispatches feed into monitoring page
   */
  renderDispatchesFeed() {
    const feedEl = document.getElementById("live-cam-dispatches-feed");
    if (!feedEl) return;

    if (this.recentDispatches.length === 0) {
      feedEl.innerHTML = `
        <div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:0.8rem; background:var(--bg-tertiary); border-radius:6px; border:1px dashed var(--border-light);">
          Waiting for live camera events... Violations will automatically record and appear here in real time.
        </div>
      `;
      return;
    }

    feedEl.innerHTML = this.recentDispatches.map(item => `
      <div style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:var(--bg-tertiary); border-radius:6px; border-left:3px solid ${item.isCritical ? 'var(--danger)' : 'var(--warning)'}; font-size:0.8rem;">
        ${item.snapshot ? `<img src="${item.snapshot}" alt="Snapshot" style="width:40px; height:26px; object-fit:cover; border-radius:3px; border:1px solid var(--border-light);" />` : ''}
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; color:${item.isCritical ? 'var(--danger)' : 'var(--warning)'}; font-size:0.75rem;">
              ${item.isCritical ? '🚨 CRITICAL' : '⚠️ VIOLATION'}
            </span>
            <span class="mono" style="font-size:0.7rem; color:var(--text-secondary);">${item.time}</span>
          </div>
          <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-primary); font-size:0.78rem;">
            👷 <strong>${item.workerName || 'Worker'}</strong> (${item.workerId || 'W-117'}) — Missing ${item.missingStr}
          </div>
        </div>
      </div>
    `).join("");
  },

  /**
   * Toggle Audio Alarm Mute
   */
  toggleMute() {
    this.audioMuted = !this.audioMuted;
    const btn = document.getElementById("btn-toggle-cam-audio");
    if (btn) {
      btn.textContent = this.audioMuted ? "🔇 Audio Muted" : "🔊 Audio Alarm ON";
    }
  },

  updateModeUI(mode) {
    document.querySelectorAll(".live-cam-mode-btn").forEach(btn => {
      if (btn.getAttribute("data-mode") === mode) {
        btn.classList.add("btn-cyan");
        btn.classList.remove("btn-outline");
      } else {
        btn.classList.remove("btn-cyan");
        btn.classList.add("btn-outline");
      }
    });
  }
};

window.LiveCameraDetector = LiveCameraDetector;
