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

export function drawAngleDifferences(ctx, landmarks, angleDiffs = {}, options = {}) {
  if (!ctx || !landmarks) return;

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
  const reference = options.referenceLandmarks || null;
  const minVisibleDiff = options.minVisibleDiff ?? 5;
  const maxDiff = options.maxDiff ?? 60;
  const minRadius = options.minRadius ?? 24;
  const maxRadius = options.maxRadius ?? 90;
  const ringWidth = options.ringWidth ?? 3;
  const baseRgb = options.baseRgb ?? '231,76,60';
  const showLabels = options.showLabels ?? true;
  const fontSize = options.fontSize ?? 12;
  const labelPaddingX = options.labelPaddingX ?? 6;
  const labelPaddingY = options.labelPaddingY ?? 4;
  const maxAlpha = options.maxAlpha ?? 0.88;
  const minVisibleDistance = options.minVisibleDistance ?? 0.035;
  const maxDistanceNorm = options.maxDistanceNorm ?? 0.25;
  const connectorWidth = options.connectorWidth ?? 2.5;

  ctx.save();
  ctx.lineWidth = ringWidth;
  ctx.font = `${options.fontWeight ?? 600} ${fontSize}px "Inter", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalCompositeOperation = options.compositeOperation ?? 'lighter';

  for (const [key, idx] of Object.entries(mapping)) {
    const studentLandmark = landmarks[idx];
    const refLandmark = reference ? reference[idx] : null;
    if (!studentLandmark && !refLandmark) continue;

    const diff = angleDiffs[key];
    const hasAngle = Number.isFinite(diff);
    const angleMagnitude = hasAngle ? Math.abs(diff) : 0;

    let distanceNorm = 0;
    let distancePx = 0;
    if (studentLandmark && refLandmark) {
      const dx = studentLandmark.x - refLandmark.x;
      const dy = studentLandmark.y - refLandmark.y;
      distanceNorm = Math.hypot(dx, dy);
      distancePx = Math.hypot(dx * w, dy * h);
    }

    const showDueToAngle = hasAngle && angleMagnitude >= minVisibleDiff;
    const showDueToDistance = distanceNorm >= minVisibleDistance;
    if (!showDueToAngle && !showDueToDistance) continue;

    const intensityAngle = hasAngle ? Math.min(angleMagnitude / maxDiff, 1) : 0;
    const intensityDistance = Math.min(distanceNorm / maxDistanceNorm, 1);
    const intensity = Math.max(intensityAngle, intensityDistance);

    const origin = studentLandmark || refLandmark;
    const x = origin.x * w;
    const y = origin.y * h;

    const radius = minRadius + (maxRadius - minRadius) * intensity;
    const innerAlpha = Math.min(0.32 + 0.48 * intensity, maxAlpha);
    const midAlpha = Math.min(0.2 + 0.4 * intensity, maxAlpha);

    if (studentLandmark && refLandmark) {
      ctx.save();
      ctx.globalCompositeOperation = options.connectorComposite ?? 'source-over';
      ctx.strokeStyle = `rgba(${baseRgb},${0.25 + 0.5 * intensity})`;
      ctx.lineWidth = connectorWidth;
      ctx.beginPath();
      ctx.moveTo(refLandmark.x * w, refLandmark.y * h);
      ctx.lineTo(studentLandmark.x * w, studentLandmark.y * h);
      ctx.stroke();
      ctx.restore();
    }

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${baseRgb},${innerAlpha})`);
    gradient.addColorStop(0.65, `rgba(${baseRgb},${midAlpha})`);
    gradient.addColorStop(1, `rgba(${baseRgb},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(${baseRgb},${0.3 + 0.5 * intensity})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (showLabels) {
      const labelParts = [];
      if (showDueToAngle && hasAngle) {
        labelParts.push(`${Math.round(angleMagnitude)}°`);
      }
      if (showDueToDistance && distancePx > 0) {
        labelParts.push(`${Math.round(distancePx)}px`);
      }
      if (labelParts.length === 0) continue;
      const label = labelParts.join(' • ');
      const labelWidth = ctx.measureText(label).width + labelPaddingX * 2;
      const labelHeight = fontSize + labelPaddingY * 2;
      const labelOffset = radius + labelHeight + 6;
      const labelCenterY = Math.max(labelHeight / 2 + 4, y - labelOffset);
      const rectX = x - labelWidth / 2;
      const rectY = labelCenterY - labelHeight / 2;
      const radiusRect = Math.min(10, labelHeight / 2);

      ctx.save();
      ctx.globalCompositeOperation = options.labelComposite ?? 'source-over';
      ctx.fillStyle = `rgba(${baseRgb},0.94)`;
      drawRoundedRectPath(ctx, rectX, rectY, labelWidth, labelHeight, radiusRect);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x, labelCenterY);
      ctx.restore();
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
