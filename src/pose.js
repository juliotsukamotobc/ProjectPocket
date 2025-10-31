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
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  const baseThickness = Math.max(1, style.thickness ?? style.lineWidth ?? 6);
  const colors = {
    start: "rgba(30,144,255,0.9)",
    end: "rgba(30,144,255,0.25)",
    glow: "rgba(30,144,255,0.5)",
    jointHalo: "rgba(30,144,255,0.45)",
    jointCore: "#ffffff",
    ...(style.colors || {})
  };
  const jointRadius = Math.max(2, style.jointRadius ?? baseThickness * 1.4);
  const jointCoreRadius = Math.max(1.5, style.jointCoreRadius ?? jointRadius * 0.55);

  const bones = [
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [23, 25], [25, 27],
    [24, 26], [26, 28],
    [11, 12], [23, 24],
    [11, 23], [12, 24],
    [15, 17], [15, 19], [15, 21], [17, 19], [19, 21],
    [16, 18], [16, 20], [16, 22], [18, 20], [20, 22]
  ];

  const joints = [
    11, 12, 13, 14, 15, 16,
    17, 18, 19, 20, 21, 22,
    23, 24, 25, 26, 27, 28
  ];

  function drawBoneCapsule(aIdx, bIdx) {
    const pa = landmarks[aIdx];
    const pb = landmarks[bIdx];
    if (!pa || !pb) return;
    const ax = pa.x * w;
    const ay = pa.y * h;
    const bx = pb.x * w;
    const by = pb.y * h;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len < 1e-3) return;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.atan2(dy, dx));

    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, colors.start);
    grad.addColorStop(1, colors.end);

    ctx.fillStyle = grad;
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = baseThickness * 1.25;

    const r = baseThickness / 2;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(len, -r);
    ctx.arc(len, 0, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(0, r);
    ctx.arc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawJointGlow(idx) {
    const p = landmarks[idx];
    if (!p) return;
    const x = p.x * w;
    const y = p.y * h;

    ctx.save();
    const halo = ctx.createRadialGradient(x, y, 0, x, y, jointRadius);
    halo.addColorStop(0, colors.jointHalo);
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, jointRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = baseThickness;
    ctx.fillStyle = colors.jointCore;
    ctx.beginPath();
    ctx.arc(x, y, jointCoreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const [a, b] of bones) {
    drawBoneCapsule(a, b);
  }

  for (const idx of joints) {
    drawJointGlow(idx);
  }

  ctx.restore();
}

export function drawAngleDifferences(ctx, landmarks, angleDiffs, options = {}) {
  if (!ctx || !landmarks || !angleDiffs) return;

  const mapping = {
    leftElbow: 13,
    rightElbow: 14,
    leftKnee: 25,
    rightKnee: 26,
    leftShoulder: 11,
    rightShoulder: 12,
    leftHip: 23,
    rightHip: 24
  };

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const minVisibleDiff = options.minVisibleDiff ?? 5;
  const maxDiff = options.maxDiff ?? 60;
  const minRadius = options.minRadius ?? 24;
  const maxRadius = options.maxRadius ?? 80;
  const ringWidth = options.ringWidth ?? 3;
  const baseRgb = options.baseRgb ?? '231,76,60';
  const showLabels = options.showLabels ?? true;
  const fontSize = options.fontSize ?? 12;
  const labelPaddingX = options.labelPaddingX ?? 6;
  const labelPaddingY = options.labelPaddingY ?? 4;
  const maxAlpha = options.maxAlpha ?? 0.82;

  ctx.save();
  ctx.lineWidth = ringWidth;
  ctx.font = `${options.fontWeight ?? 600} ${fontSize}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const [key, idx] of Object.entries(mapping)) {
    const diff = angleDiffs[key];
    if (!Number.isFinite(diff)) continue;
    const magnitude = Math.abs(diff);
    if (magnitude < minVisibleDiff) continue;

    const landmark = landmarks[idx];
    if (!landmark) continue;
    const x = landmark.x * w;
    const y = landmark.y * h;

    const t = Math.min(magnitude / maxDiff, 1);
    const radius = minRadius + (maxRadius - minRadius) * t;
    const innerAlpha = Math.min(0.28 + 0.42 * t, maxAlpha);
    const midAlpha = Math.min(0.18 + 0.36 * t, maxAlpha);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${baseRgb},${innerAlpha})`);
    gradient.addColorStop(0.65, `rgba(${baseRgb},${midAlpha})`);
    gradient.addColorStop(1, `rgba(${baseRgb},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${baseRgb},${0.25 + 0.5 * t})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (showLabels) {
      const label = `${Math.round(magnitude)}°`;
      const labelWidth = ctx.measureText(label).width + labelPaddingX * 2;
      const labelHeight = fontSize + labelPaddingY * 2;
      const labelOffset = radius + labelHeight + 6;
      const labelCenterY = Math.max(labelHeight / 2 + 4, y - labelOffset);
      const rectX = x - labelWidth / 2;
      const rectY = labelCenterY - labelHeight / 2;
      const radiusRect = Math.min(10, labelHeight / 2);

      ctx.fillStyle = `rgba(${baseRgb},0.9)`;
      drawRoundedRectPath(ctx, rectX, rectY, labelWidth, labelHeight, radiusRect);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x, labelCenterY);
    }
  }

  ctx.restore();
}

function drawRoundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
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
