const canvas = document.querySelector("#graph");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#plot-form");
const expressionInput = document.querySelector("#expression");
const status = document.querySelector("#status");
const fields = ["min-x", "max-x", "min-y", "max-y"].map((id) => document.querySelector(`#${id}`));
const defaultView = [-10, 10, -5, 5];
let view = [...defaultView];
let fn = compileExpression(expressionInput.value);

function compileExpression(source) {
  const expression = source.trim().replaceAll("^", "**");
  if (!expression || expression.length > 120) throw new Error("式を入力してください（120文字以内）。");
  if (!/^[0-9x+\-*/%().,\s_a-zA-Z**]+$/.test(expression)) throw new Error("使用できない文字が含まれています。");
  const names = ["sin", "cos", "tan", "sqrt", "abs", "log", "exp", "floor", "ceil", "round", "PI", "E"];
  const identifiers = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  if (identifiers.some((name) => name !== "x" && !names.includes(name))) throw new Error("未対応の関数または変数です。");
  const body = expression.replace(/\b(sin|cos|tan|sqrt|abs|log|exp|floor|ceil|round)\b/g, "Math.$1")
    .replace(/\bPI\b/g, "Math.PI").replace(/\bE\b/g, "Math.E");
  try {
    const evaluator = new Function("x", `"use strict"; return (${body});`);
    return (x) => {
      const value = Number(evaluator(x));
      return Number.isFinite(value) ? value : null;
    };
  } catch {
    throw new Error("式を解釈できません。");
  }
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function readView() {
  const next = fields.map((field) => Number(field.value));
  if (next.some((value) => !Number.isFinite(value)) || next[0] >= next[1] || next[2] >= next[3]) {
    throw new Error("表示範囲の値を確認してください。");
  }
  view = next;
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  const [minX, maxX, minY, maxY] = view;
  const px = (x) => (x - minX) / (maxX - minX) * width;
  const py = (y) => height - (y - minY) / (maxY - minY) * height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcff";
  ctx.fillRect(0, 0, width, height);
  const step = Math.pow(10, Math.floor(Math.log10(Math.max(maxX - minX, maxY - minY) / 8)));
  ctx.lineWidth = 1;
  ctx.font = "12px system-ui";
  for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
    ctx.strokeStyle = "#e9edf5"; ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), height); ctx.stroke();
    if (Math.abs(x) > step / 100) { ctx.fillStyle = "#8d98aa"; ctx.fillText(format(x), px(x) + 4, Math.min(height - 5, Math.max(14, py(0) - 5))); }
  }
  for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
    ctx.strokeStyle = "#e9edf5"; ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(width, py(y)); ctx.stroke();
    if (Math.abs(y) > step / 100) { ctx.fillStyle = "#8d98aa"; ctx.fillText(format(y), Math.min(width - 30, Math.max(4, px(0) + 5)), py(y) - 5); }
  }
  ctx.strokeStyle = "#63708a"; ctx.lineWidth = 1.5;
  if (minY <= 0 && maxY >= 0) { ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(width, py(0)); ctx.stroke(); }
  if (minX <= 0 && maxX >= 0) { ctx.beginPath(); ctx.moveTo(px(0), 0); ctx.lineTo(px(0), height); ctx.stroke(); }
  ctx.strokeStyle = "#5267d9"; ctx.lineWidth = 2.5; ctx.beginPath();
  let penDown = false;
  for (let i = 0; i <= width; i += 1) {
    const x = minX + i / width * (maxX - minX);
    const y = fn(x);
    const valid = y !== null && y >= minY - (maxY - minY) * 2 && y <= maxY + (maxY - minY) * 2;
    if (!valid) { penDown = false; continue; }
    if (penDown) ctx.lineTo(i, py(y)); else ctx.moveTo(i, py(y));
    penDown = true;
  }
  ctx.stroke();
}

function format(value) { return Number(value.toPrecision(3)).toString(); }
function syncFields() { fields.forEach((field, index) => { field.value = view[index]; }); }

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try { fn = compileExpression(expressionInput.value); readView(); draw(); setStatus("描画しました"); }
  catch (error) { setStatus(error.message, true); }
});
document.querySelectorAll(".example").forEach((button) => button.addEventListener("click", () => {
  expressionInput.value = button.dataset.expression; form.requestSubmit();
}));
fields.forEach((field) => field.addEventListener("change", () => form.requestSubmit()));
document.querySelector("#reset-view").addEventListener("click", () => { view = [...defaultView]; syncFields(); draw(); setStatus("表示範囲をリセットしました"); });
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 0.9 : 1.1;
  const rect = canvas.getBoundingClientRect();
  const cursorX = view[0] + (event.offsetX / rect.width) * (view[1] - view[0]);
  const cursorY = view[3] - (event.offsetY / rect.height) * (view[3] - view[2]);
  view = [cursorX + (view[0] - cursorX) * factor, cursorX + (view[1] - cursorX) * factor, cursorY + (view[2] - cursorY) * factor, cursorY + (view[3] - cursorY) * factor];
  syncFields(); draw();
}, { passive: false });
window.addEventListener("resize", draw);
draw();
