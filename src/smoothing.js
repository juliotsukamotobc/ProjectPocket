// smoothing.js - basic temporal smoothing (moving average)
export class MovingAverage {
  constructor(windowSize = 5) {
    this.windowSize = windowSize;
    this.buffer = [];
    this.lastOutput = null;
    // Tamanho máximo permitido para pequenas oscilações antes de suavizar agressivamente.
    this.jitterRadius = 0.0125; // ~1.25% do quadro normalizado
    // Mesmo quando abaixo do limite de jitter, ainda aplicamos um avanço mínimo.
    this.minBlend = 0.2;
  }
  setWindowSize(n) {
    this.windowSize = Math.max(1, Math.floor(n));
    this.reset();
  }
  reset() {
    this.buffer = [];
    this.lastOutput = null;
  }
  push(landmarks) {
    if (!landmarks) return null;
    this.buffer.push(landmarks.map(p => ({x:p.x, y:p.y, z:p.z, visibility:p.visibility ?? 0})));
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    const averaged = this.avg();
    if (!averaged) return null;

    const stabilised = averaged.map((point, idx) => {
      if (!this.lastOutput || !this.lastOutput[idx]) {
        return { ...point };
      }

      const prev = this.lastOutput[idx];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const dz = point.z - prev.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (!Number.isFinite(dist)) {
        return { ...point };
      }

      const ratio = Math.min(1, dist / this.jitterRadius);
      const blend = this.minBlend + (1 - this.minBlend) * ratio;

      return {
        x: prev.x + dx * blend,
        y: prev.y + dy * blend,
        z: prev.z + dz * blend,
        visibility: (prev.visibility + point.visibility) / 2
      };
    });

    this.lastOutput = stabilised.map(p => ({ ...p }));
    return this.lastOutput;
  }
  avg() {
    if (this.buffer.length === 0) return null;
    const n = this.buffer.length;
    const L = this.buffer[0].length;
    const out = new Array(L).fill(0).map(()=>({x:0,y:0,z:0,visibility:0}));
    for (const frame of this.buffer) {
      for (let i=0;i<L;i++){
        out[i].x += frame[i].x;
        out[i].y += frame[i].y;
        out[i].z += frame[i].z;
        out[i].visibility += frame[i].visibility;
      }
    }
    for (let i=0;i<L;i++){
      out[i].x /= n;
      out[i].y /= n;
      out[i].z /= n;
      out[i].visibility /= n;
    }
    return out;
  }
}
