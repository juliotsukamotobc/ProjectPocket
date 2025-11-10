// ui.js - small helpers for UI
export function log(line) {
  const el = document.getElementById('log');
  if (!el) {
    console.log(line);
    return;
  }
  el.textContent = (line + "\n" + el.textContent).slice(0, 4000);
}
export function downloadJSON(obj, filename="movimento_instrutor.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
