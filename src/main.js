// main.js - app glue
import { PoseEngine, drawPose, computeAngles } from './pose.js';
import { MovingAverage } from './smoothing.js';
import { log, showAngles, downloadJSON } from './ui.js';

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const btnStartCam = document.getElementById('btnStartCam');
const btnRecord = document.getElementById('btnRecord');
const btnStop = document.getElementById('btnStop');
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const btnCompare = document.getElementById('btnCompare');
const fileImport = document.getElementById('fileImport');
const smoothWindow = document.getElementById('smoothWindow');
const lineWidth = document.getElementById('lineWidth');

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

btnCompare.disabled = true;

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
    log('Camera started');
  } catch (e) {
    console.error(e);
    log('Camera error: ' + e.message);
  }
});

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
    log('Pose engine ready');
  }
}

// Recording
btnRecord.addEventListener('click', ()=>{
  if (!running) { log('Start the camera first'); return; }
  startRecording();
});

btnStop.addEventListener('click', ()=> stopRecording(true));

btnCompare.addEventListener('click', ()=>{
  startComparison();
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
  btnCompare.disabled = true;
  log(`Recording started (max ${RECORD_DURATION_MS / 1000}s)`);
}

function stopRecording(manual = false) {
  if (!recording) return;
  recording = false;
  recordingStartTime = null;
  btnStop.disabled = true;
  btnRecord.disabled = false;
  btnExport.disabled = instructorFrames.length === 0;
  btnCompare.disabled = instructorFrames.length === 0;
  const reason = manual ? 'stopped manually' : 'completed automatically';
  log(`Recording ${reason} (${instructorFrames.length} frames)`);
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
  ensureInstructorAngles();
  log('Comparação iniciada usando a última gravação do instrutor.');
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
    if (!data.frames) throw new Error('Invalid file');
    instructorFrames = data.frames;
    instructorAngles = data.angles || [];
    if (!Array.isArray(instructorAngles) || instructorAngles.length === 0) {
      instructorAngles = instructorFrames.map(frame => computeAngles(frame));
    }
    compareActive = false;
    compareIndex = 0;
    compareStartTime = 0;
    btnCompare.disabled = instructorFrames.length === 0;
    log(`Loaded instructor JSON: ${instructorFrames.length} frames`);
  } catch (err) {
    log('Invalid JSON: ' + err.message);
  } finally {
    fileImport.value = '';
  }
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

  // draw
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawPose(ctx, landmarks, { lineWidth: parseInt(lineWidth.value,10), strokeStyle: "rgba(46,204,113,0.95)", fillStyle: "rgba(46,204,113,0.95)" });
  if (compareActive && instructorFrames.length > 0) {
    advanceComparisonFrame();
  }
  const overlayFrame = getInstructorFrameForDisplay();
  if (overlayFrame) {
    drawPose(ctx, overlayFrame, { lineWidth: parseInt(lineWidth.value,10), strokeStyle: "rgba(30,144,255,0.9)", fillStyle: "rgba(30,144,255,0.9)" });
  }

  // angles + diff
  const ang = computeAngles(landmarks);
  showAngles(ang);

  if (recording && role === "instructor" && landmarks) {
    instructorFrames.push(landmarks);
    instructorAngles.push(ang);
  }

  if (recording && recordingStartTime && (performance.now() - recordingStartTime) >= RECORD_DURATION_MS) {
    stopRecording(false);
  }

  // diff display em loop quando comparação estiver ativa
  if (compareActive && role === "student" && ang) {
    const ref = getInstructorAnglesForComparison();
    if (ref) {
      const keys = Object.keys(ang);
      const diffs = keys.map(k => Math.abs((ang[k]||0) - (ref[k]||0)));
      const avgDiff = diffs.reduce((a,b)=>a+b,0)/diffs.length;
      if (Number.isFinite(avgDiff)) {
        log(`Avg diff (frame ${compareIndex + 1}/${instructorFrames.length}): ${avgDiff.toFixed(1)} deg`);
      }
    }
  }

  requestAnimationFrame(loop);
}
