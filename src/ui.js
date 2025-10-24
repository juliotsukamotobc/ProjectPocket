// ui.js - small helpers for UI
export function log(line) {
  const el = document.getElementById('log');
  el.textContent = (line + "\n" + el.textContent).slice(0, 4000);
}
export function showAngles(angles) {
  const box = document.getElementById('angles');
  if (!angles) { box.textContent = "(no pose)"; return; }
  box.innerHTML = Object.entries(angles)
    .map(([k,v]) => `<div><strong>${k}</strong>: ${v.toFixed(1)}</div>`)
    .join("");
}
export function downloadJSON(obj, filename="instructor_motion.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
