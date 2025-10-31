// main.js - app glue
import { PoseEngine, drawPose, computeAngles, drawAngleDifferences } from './pose.js';
import { MovingAverage } from './smoothing.js';
import { log, showAngles, downloadJSON } from './ui.js';

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const recordingTimer = document.getElementById('recordingTimer');
const btnStartCam = document.getElementById('btnStartCam');
const btnRecord = document.getElementById('btnRecord');
const btnStop = document.getElementById('btnStop');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const btnCompare = document.getElementById('btnCompare');
const btnStopCompare = document.getElementById('btnStopCompare');
const btnStopCam = document.getElementById('btnStopCam');
const fileImport = document.getElementById('fileImport');
const smoothWindow = document.getElementById('smoothWindow');
const lineWidth = document.getElementById('lineWidth');

function poseThickness() {
  const raw = parseInt(lineWidth.value, 10);
  if (!Number.isFinite(raw)) return 6;
  return Math.max(3, Math.round(raw * 1.6));
}

function poseStyle(base) {
  const thickness = poseThickness();
  if (base === 'overlay') {
    return {
      thickness: Math.max(2, thickness - 1),
      colors: {
        start: 'rgba(52,152,219,0.95)',
        end: 'rgba(52,152,219,0.25)',
        glow: 'rgba(52,152,219,0.45)',
        jointHalo: 'rgba(52,152,219,0.35)',
        jointCore: '#f0f6ff'
      }
    };
  }
  return {
    thickness,
    colors: {
      start: 'rgba(46,204,113,0.95)',
      end: 'rgba(46,204,113,0.25)',
      glow: 'rgba(46,204,113,0.55)',
      jointHalo: 'rgba(46,204,113,0.4)',
      jointCore: '#f6fff9'
    }
  };
}

let role = "instructor";
let running = false;
let recording = false;
let recordingStartTime = null;
const RECORD_DURATION_MS = 4000;
let instructorFrames = []; // array de landmarks do instrutor (para referência)
let instructorAngles = []; // ângulos por frame (auxiliar)
let poseEngine;
let smoother = new MovingAverage(parseInt(smoothWindow.value,10));
let compareActive = false;
let compareStartTime = 0;
let compareIndex = 0;
const COMPARE_FPS = 30;
let lastDiffLogTime = 0;

btnCompare.disabled = true;
btnStopCompare.disabled = true;

function updateComparisonButtons() {
  const hasData = instructorFrames.length > 0;
  btnCompare.disabled = !hasData || compareActive;
  btnStopCompare.disabled = !compareActive;
}

function formatDuration(ms) {
  const clamped = Math.min(Math.max(ms, 0), RECORD_DURATION_MS);
  return (clamped / 1000).toFixed(3).replace('.', ',') + ' s';
}

function showRecordingTimer(startValue = 0) {
  if (!recordingTimer) return;
  recordingTimer.classList.remove('hidden');
  recordingTimer.textContent = formatDuration(startValue);
}

function hideRecordingTimer() {
  if (!recordingTimer) return;
  recordingTimer.classList.add('hidden');
  recordingTimer.textContent = formatDuration(0);
}

function updateRecordingTimer(now) {
  if (!recordingTimer || !recording || !recordingStartTime) return;
  const elapsed = Math.min(now - recordingStartTime, RECORD_DURATION_MS);
  recordingTimer.textContent = formatDuration(elapsed);
}

// Role selector
document.querySelectorAll('input[name="role"]').forEach(r=>{
  r.addEventListener('change', (e)=> role = e.target.value);
});

smoothWindow.addEventListener('input', ()=> {
  smoother.setWindowSize(parseInt(smoothWindow.value,10));
});

lineWidth.addEventListener('input', ()=>{});

// Camera setup
btnStartCam.addEventListener('click', async ()=>{
  try {
    await ensurePoseEngine();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;
    await video.play();
    resizeCanvas();
    running = true;
    requestAnimationFrame(loop);
    btnStartCam.disabled = true;
    if (btnStopCam) btnStopCam.disabled = false;
    log('Câmera iniciada');
  } catch (e) {
    console.error(e);
    log('Erro da câmera: ' + e.message);
  }
});

if (btnStopCam) {
  btnStopCam.addEventListener('click', ()=>{
    stopCamera();
  });
}

function stopCamera() {
  if (!running && !video.srcObject) {
    return;
  }
  const stream = video.srcObject;
  if (stream && typeof stream.getTracks === 'function') {
    stream.getTracks().forEach(track => track.stop());
  }
  video.srcObject = null;
  running = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  smoother.reset();
  stopRecording(true);
  stopComparison(true);
  btnStartCam.disabled = false;
  if (btnStopCam) btnStopCam.disabled = true;
  log('Câmera parada');
}

window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  const rect = video.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

async function ensurePoseEngine() {
  if (!poseEngine) {
    poseEngine = new PoseEngine();
    await poseEngine.init();
    log('Processador de pose pronto');
  }
}

// Recording
btnRecord.addEventListener('click', ()=>{
  if (!running) { log('Inicie a câmera primeiro'); return; }
  startRecording();
});

btnStop.addEventListener('click', ()=> stopRecording(true));

btnCompare.addEventListener('click', ()=>{
  startComparison();
});

btnStopCompare.addEventListener('click', ()=>{
  stopComparison(true);
});

function startRecording() {
  recording = true;
  recordingStartTime = performance.now();
  instructorFrames = [];
  instructorAngles = [];
  compareActive = false;
  compareIndex = 0;
  compareStartTime = 0;
  btnStop.disabled = false;
  btnRecord.disabled = true;
  btnExport.disabled = true;
  showRecordingTimer(0);
  updateComparisonButtons();
  log(`Gravação iniciada (máx ${RECORD_DURATION_MS / 1000}s)`);
}

function stopRecording(manual = false) {
  if (!recording) return;
  recording = false;
  recordingStartTime = null;
  btnStop.disabled = true;
  btnRecord.disabled = false;
  btnExport.disabled = instructorFrames.length === 0;
  hideRecordingTimer();
  const reason = manual ? 'interrompida manualmente' : 'finalizada automaticamente';
  log(`Gravação ${reason} (${instructorFrames.length} quadros)`);
  updateComparisonButtons();
}

function startComparison() {
  if (!running) {
    log('Inicie a câmera antes de comparar.');
    return;
  }
  if (instructorFrames.length === 0) {
    log('Nenhuma gravação encontrada para comparar.');
    return;
  }
  compareActive = true;
  compareStartTime = performance.now();
  compareIndex = 0;
  lastDiffLogTime = 0;
  ensureInstructorAngles();
  log('Comparação iniciada usando a última gravação do instrutor.');
  updateComparisonButtons();
}

function stopComparison(manual = false) {
  if (!compareActive) return;
  compareActive = false;
  compareIndex = 0;
  compareStartTime = 0;
  lastDiffLogTime = 0;
  if (manual) {
    log('Comparação parada.');
  }
  updateComparisonButtons();
}

btnExport.addEventListener('click', ()=>{
  const payload = { frames: instructorFrames, angles: instructorAngles, fps: 30, createdAt: new Date().toISOString() };
  downloadJSON(payload);
});

btnImport.addEventListener('click', ()=> fileImport.click());
fileImport.addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!data.frames) throw new Error('Arquivo inválido');
    instructorFrames = data.frames;
    instructorAngles = data.angles || [];
    if (!Array.isArray(instructorAngles) || instructorAngles.length === 0) {
      instructorAngles = instructorFrames.map(frame => computeAngles(frame));
    }
    compareActive = false;
    compareIndex = 0;
    compareStartTime = 0;
    log(`JSON do instrutor carregado: ${instructorFrames.length} quadros`);
  } catch (err) {
    log('JSON inválido: ' + err.message);
  } finally {
    fileImport.value = '';
  }
  updateComparisonButtons();
});

function getInstructorFrameForDisplay() {
  if (instructorFrames.length === 0) return null;
  if (compareActive) {
    return instructorFrames[compareIndex % instructorFrames.length];
  }
  return instructorFrames[0];
}

function ensureInstructorAngles() {
  if (instructorFrames.length === 0) return;
  if (!Array.isArray(instructorAngles) || instructorAngles.length !== instructorFrames.length) {
    instructorAngles = instructorFrames.map(frame => computeAngles(frame));
  }
}

function getInstructorAnglesForComparison() {
  if (instructorFrames.length === 0) return null;
  ensureInstructorAngles();
  if (!Array.isArray(instructorAngles) || instructorAngles.length === 0) return null;
  if (compareActive) {
    return instructorAngles[compareIndex % instructorAngles.length];
  }
  return instructorAngles[0];
}

function advanceComparisonFrame() {
  if (instructorFrames.length === 0) {
    compareActive = false;
    return;
  }
  const frameDuration = 1000 / COMPARE_FPS;
  const elapsed = performance.now() - compareStartTime;
  const frameCount = instructorFrames.length;
  if (frameCount === 0 || frameDuration <= 0) {
    compareIndex = 0;
    return;
  }
  compareIndex = Math.floor(elapsed / frameDuration) % frameCount;
}

// Main loop
function loop() {
  if (!running) return;
  const landmarksRaw = poseEngine.detect(video);
  const landmarks = smoother.push(landmarksRaw) || landmarksRaw;
  const now = performance.now();

  const ang = computeAngles(landmarks);

  // draw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPose(ctx, landmarks, poseStyle('active'));
  if (compareActive && instructorFrames.length > 0) {
    advanceComparisonFrame();
  }
  const overlayFrame = getInstructorFrameForDisplay();
  if (overlayFrame) {
    drawPose(ctx, overlayFrame, poseStyle('overlay'));
  }

  let currentDiffs = null;
  if (compareActive && ang) {
    const refAngles = getInstructorAnglesForComparison();
    if (refAngles) {
      currentDiffs = {};
      const keys = new Set([...Object.keys(refAngles || {}), ...Object.keys(ang || {})]);
      for (const key of keys) {
        const refValue = refAngles[key];
        const studentValue = ang[key];
        if (Number.isFinite(refValue) && Number.isFinite(studentValue)) {
          currentDiffs[key] = studentValue - refValue;
        }
      }
      if (Object.keys(currentDiffs).length === 0) {
        currentDiffs = null;
      }
    }
  }

  if (currentDiffs) {
    drawAngleDifferences(ctx, landmarks, currentDiffs, {
      minVisibleDiff: 4,
      maxDiff: 70,
      showLabels: true
    });
  }

  // angles + diff
  showAngles(ang);

  if (recording && role === "instructor" && landmarks) {
    instructorFrames.push(landmarks);
    instructorAngles.push(ang);
  }

  if (recording && recordingStartTime) {
    updateRecordingTimer(now);
  }

  if (recording && recordingStartTime && (now - recordingStartTime) >= RECORD_DURATION_MS) {
    stopRecording(false);
  }

  // diff display em loop quando comparação estiver ativa
  if (compareActive && role === "student" && ang) {
    const diffValues = currentDiffs
      ? Object.values(currentDiffs).map(v => Math.abs(v)).filter(Number.isFinite)
      : null;
    if (diffValues && diffValues.length > 0) {
      const avgDiff = diffValues.reduce((a, b) => a + b, 0) / diffValues.length;
      if (Number.isFinite(avgDiff)) {
        const nowTs = performance.now();
        if (nowTs - lastDiffLogTime > 750) {
          log(`Diferença média (quadro ${compareIndex + 1}/${instructorFrames.length}): ${avgDiff.toFixed(1)}°`);
          lastDiffLogTime = nowTs;
        }
      }
    }
  }

  requestAnimationFrame(loop);
}
