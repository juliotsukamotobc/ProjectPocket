// ui.js - small helpers for UI
export function log(line) {
  const el = document.getElementById('log');
  el.textContent = (line + "\n" + el.textContent).slice(0, 4000);
}
const angleLabels = {
  leftElbow: 'Cotovelo esquerdo',
  rightElbow: 'Cotovelo direito',
  leftKnee: 'Joelho esquerdo',
  rightKnee: 'Joelho direito',
  leftShoulder: 'Ombro esquerdo',
  rightShoulder: 'Ombro direito',
  leftHip: 'Quadril esquerdo',
  rightHip: 'Quadril direito'
};

export function showAngles(angles) {
  const box = document.getElementById('angles');
  if (!angles) { box.textContent = '(sem pose)'; return; }
  box.innerHTML = Object.entries(angles)
    .map(([k,v]) => {
      const label = angleLabels[k] || k;
      return `<div><strong>${label}</strong>: ${v.toFixed(1)}</div>`;
    })
    .join("");
}
export function downloadJSON(obj, filename="movimento_instrutor.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
