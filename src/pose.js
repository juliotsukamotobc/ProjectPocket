// pose.js - Pose utilities (MediaPipe wrapper + drawing + angles)
export class PoseEngine {
  constructor() {
    this.poseLandmarker = null;
  }

  async init() {
    const { FilesetResolver, PoseLandmarker } = window.PP_Mediapipe;
    const filesetResolver = await FilesetResolver.forVisionTasks(
      // Usa o CDN padrão do MediaPipe
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    this.poseLandmarker = await PoseLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false
    });
  }

  detect(videoEl) {
    if (!this.poseLandmarker) return null;
    const ts = performance.now();
    const res = this.poseLandmarker.detectForVideo(videoEl, ts);
    const landmarks = (res && res.landmarks && res.landmarks[0]) ? res.landmarks[0] : null;
    return landmarks;
  }
}

export function drawPose(ctx, landmarks, style = {}) {
  if (!landmarks) return;
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.save();
  ctx.lineWidth = style.lineWidth || 3;
  ctx.strokeStyle = style.strokeStyle || "rgba(30,144,255,0.9)";
  ctx.fillStyle = style.fillStyle || "rgba(30,144,255,0.9)";
  // Desenha pontos (apenas corpo, sem rosto)
  const bodyPointIndices = [
    // tronco e membros superiores
    11, 12, 13, 14, 15, 16,
    // quadris e membros inferiores
    23, 24, 25, 26, 27, 28
  ];
  for (const idx of bodyPointIndices) {
    const p = landmarks[idx];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Desenha alguns segmentos principais (ombro->cotovelo->punho etc.)
  const idx = {
    // MediaPipe indices
    'lShoulder': 11, 'rShoulder': 12,
    'lElbow': 13, 'rElbow': 14,
    'lWrist': 15, 'rWrist': 16,
    'lHip': 23, 'rHip': 24,
    'lKnee': 25, 'rKnee': 26,
    'lAnkle': 27, 'rAnkle': 28
  };
  function line(a, b) {
    const pa = landmarks[a];
    const pb = landmarks[b];
    if (!pa || !pb) return;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.strokeStyle = style.strokeStyle || "rgba(30,144,255,0.9)";
  // Braço esquerdo
  line(idx.lShoulder, idx.lElbow);
  line(idx.lElbow, idx.lWrist);
  // Braço direito
  line(idx.rShoulder, idx.rElbow);
  line(idx.rElbow, idx.rWrist);
  // Perna esquerda
  line(idx.lHip, idx.lKnee);
  line(idx.lKnee, idx.lAnkle);
  // Perna direita
  line(idx.rHip, idx.rKnee);
  line(idx.rKnee, idx.rAnkle);
  // Tronco
  line(idx.lShoulder, idx.rShoulder);
  line(idx.lHip, idx.rHip);
  line(idx.lShoulder, idx.lHip);
  line(idx.rShoulder, idx.rHip);
  ctx.restore();
}

export function angle3(a, b, c) {
  // ângulo ABC (em graus) dado três pontos no plano normalizado (x,y)
  function v(from, to) { return { x: to.x - from.x, y: to.y - from.y }; }
  const v1 = v(b, a), v2 = v(b, c);
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y) || 1e-6;
  const m2 = Math.hypot(v2.x, v2.y) || 1e-6;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function computeAngles(landmarks) {
  if (!landmarks) return null;
  const i = {
    lShoulder: 11, rShoulder: 12,
    lElbow: 13, rElbow: 14,
    lWrist: 15, rWrist: 16,
    lHip: 23, rHip: 24,
    lKnee: 25, rKnee: 26,
    lAnkle: 27, rAnkle: 28
  };
  const A = {};
  A.leftElbow = angle3(landmarks[i.lShoulder], landmarks[i.lElbow], landmarks[i.lWrist]);
  A.rightElbow = angle3(landmarks[i.rShoulder], landmarks[i.rElbow], landmarks[i.rWrist]);
  A.leftKnee = angle3(landmarks[i.lHip], landmarks[i.lKnee], landmarks[i.lAnkle]);
  A.rightKnee = angle3(landmarks[i.rHip], landmarks[i.rKnee], landmarks[i.rAnkle]);
  A.leftShoulder = angle3(landmarks[i.lElbow], landmarks[i.lShoulder], landmarks[i.lHip]);
  A.rightShoulder = angle3(landmarks[i.rElbow], landmarks[i.rShoulder], landmarks[i.rHip]);
  A.leftHip = angle3(landmarks[i.lShoulder], landmarks[i.lHip], landmarks[i.lKnee]);
  A.rightHip = angle3(landmarks[i.rShoulder], landmarks[i.rHip], landmarks[i.rKnee]);
  return A;
}
