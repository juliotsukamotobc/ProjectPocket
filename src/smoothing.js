// smoothing.js - basic temporal smoothing (moving average)
export class MovingAverage {
  constructor(windowSize = 5) {
    this.windowSize = windowSize;
    this.buffer = [];
  }
  setWindowSize(n) {
    this.windowSize = Math.max(1, Math.floor(n));
    this.buffer = [];
  }
  push(landmarks) {
    if (!landmarks) return null;
    this.buffer.push(landmarks.map(p => ({x:p.x, y:p.y, z:p.z, visibility:p.visibility ?? 0})));
    if (this.buffer.length > this.windowSize) this.buffer.shift();
    return this.avg();
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
