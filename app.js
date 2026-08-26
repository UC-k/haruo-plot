const canvas = document.querySelector("#graph");
const ctx = canvas.getContext("2d");
const form = document.querySelector("#plot-form");
const expressionInput = document.querySelector("#expression");
const expressionList = document.querySelector("#expression-list");
const status = document.querySelector("#status");
const musicToggle = document.querySelector("#music-toggle");
const musicVolume = document.querySelector("#music-volume");
const musicStatus = document.querySelector("#music-status");
const musicLyrics = document.querySelector("#music-lyrics");
const fields = ["min-x", "max-x", "min-y", "max-y"].map((id) => document.querySelector(`#${id}`));
const colors = ["#5267d9", "#e05d75", "#21a179", "#ed9b40", "#8c5dcc"];
const defaultView = [-10, 10, -5, 5];
let view = [...defaultView];
let functions = [];
let dragStart = null;
let audioContext = null;
let masterGain = null;
let musicTimer = null;
let musicStep = 0;
const melody = [
  { text: "数の海を", note: 261.63, vowel: "u" },
  { text: "越えてゆこう", note: 293.66, vowel: "e" },
  { text: "グラフの星が", note: 329.63, vowel: "a" },
  { text: "ひかりだす", note: 392.0, vowel: "i" },
  { text: "点と線を", note: 329.63, vowel: "o" },
  { text: "つないだら", note: 392.0, vowel: "a" },
  { text: "未来のかたち", note: 440.0, vowel: "i" },
  { text: "見えてくる", note: 523.25, vowel: "u" },
];

function normalizeExpression(source) {
  let expression = source.trim().replace(/^\s*y\s*=\s*/i, "").replaceAll("^", "**");
  expression = expression.replace(/(\d+(?:\.\d+)?|x|\))(?=(x|\d|\(|sin|cos|tan|sqrt|abs|log|exp|floor|ceil|round|PI|E))/g, "$1*");
  return expression;
}

function compileExpression(source) {
  const expression = normalizeExpression(source);
  if (!expression || expression.length > 120) throw new Error("式を入力してください（120文字以内）。");
  if (!/^[0-9x+\-*/%().,\s_a-zA-Z]+$/.test(expression)) throw new Error("使用できない文字が含まれています。");
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

function renderFunctionList() {
  expressionList.replaceChildren();
  functions.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "expression-item";
    row.innerHTML = `<span class="expression-swatch" style="background:${item.color}"></span><span class="expression-text">y = ${item.label}</span>`;
    const remove = document.createElement("button");
    remove.className = "remove-expression";
    remove.type = "button";
    remove.textContent = "削除";
    remove.addEventListener("click", () => {
      functions.splice(index, 1);
      renderFunctionList();
      draw();
      setStatus("関数を削除しました");
    });
    row.append(remove);
    expressionList.append(row);
  });
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
  functions.forEach((item) => {
    ctx.strokeStyle = item.color; ctx.lineWidth = 2.5; ctx.beginPath();
    let penDown = false;
    for (let i = 0; i <= width; i += 1) {
      const y = item.fn(minX + i / width * (maxX - minX));
      const valid = y !== null && y >= minY - (maxY - minY) * 2 && y <= maxY + (maxY - minY) * 2;
      if (!valid) { penDown = false; continue; }
      if (penDown) ctx.lineTo(i, py(y)); else ctx.moveTo(i, py(y));
      penDown = true;
    }
    ctx.stroke();
  });
}

function format(value) { return Number(value.toPrecision(3)).toString(); }
function syncFields() { fields.forEach((field, index) => { field.value = format(view[index]); }); }

function getAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error("このブラウザはWeb Audio APIに対応していません。");
  if (!audioContext) {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(musicVolume.value) / 100;
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

function playTone(frequency, duration, startTime, type = "sine") {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.2, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playVocal(frequency, duration, startTime, vowel) {
  const formants = { a: [800, 1150], i: [350, 2200], u: [325, 700], e: [500, 1900], o: [450, 800] };
  const [firstFormant, secondFormant] = formants[vowel] || formants.a;
  const fundamental = audioContext.createOscillator();
  const fundamentalGain = audioContext.createGain();
  fundamental.type = "sawtooth";
  fundamental.frequency.value = frequency;
  fundamentalGain.gain.setValueAtTime(0.0001, startTime);
  fundamentalGain.gain.exponentialRampToValueAtTime(0.055, startTime + 0.035);
  fundamentalGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  fundamental.connect(fundamentalGain);
  fundamentalGain.connect(masterGain);
  [firstFormant, secondFormant].forEach((formant, index) => {
    const oscillator = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency * (index + 2);
    filter.type = "bandpass";
    filter.frequency.value = formant;
    filter.Q.value = 7;
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.08 : 0.045, startTime + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  });
  fundamental.start(startTime);
  fundamental.stop(startTime + duration + 0.03);
}

function scheduleMusicStep() {
  const fibonacci = [1, 1, 2, 3, 5, 8, 13, 21];
  const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
  const note = scale[fibonacci[musicStep % fibonacci.length] % scale.length];
  const vocal = melody[musicStep % melody.length];
  const now = audioContext.currentTime;
  playTone(note, 0.25, now, "triangle");
  if (musicStep % 4 === 0) playTone(note / 2, 0.45, now, "sine");
  playVocal(vocal.note, 0.27, now, vocal.vowel);
  musicLyrics.textContent = `♪ ${vocal.text}`;
  musicStep += 1;
}

async function toggleMusic() {
  try {
    const context = getAudioContext();
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
      musicToggle.textContent = "BGMを再生";
      musicStatus.textContent = "停止中";
      musicLyrics.textContent = "♪ 再生ボタンで歌が始まります";
      return;
    }
    await context.resume();
    musicStep = 0;
    scheduleMusicStep();
    musicTimer = setInterval(scheduleMusicStep, 320);
    musicToggle.textContent = "BGMを停止";
    musicStatus.textContent = "再生中";
  } catch (error) {
    musicStatus.textContent = "利用不可";
    setStatus(error.message, true);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const label = normalizeExpression(expressionInput.value);
    const fn = compileExpression(expressionInput.value);
    readView();
    if (!functions.some((item) => item.label === label)) functions.push({ label, fn, color: colors[functions.length % colors.length] });
    renderFunctionList();
    draw();
    expressionInput.value = "";
    setStatus("関数を追加しました");
  } catch (error) { setStatus(error.message, true); }
});
document.querySelectorAll(".example").forEach((button) => button.addEventListener("click", () => {
  expressionInput.value = button.dataset.expression; form.requestSubmit();
}));
fields.forEach((field) => field.addEventListener("change", () => {
  try { readView(); draw(); setStatus("表示範囲を更新しました"); } catch (error) { setStatus(error.message, true); }
}));
document.querySelector("#reset-view").addEventListener("click", () => { view = [...defaultView]; syncFields(); draw(); setStatus("表示範囲をリセットしました"); });
document.querySelector("#clear-functions").addEventListener("click", () => { functions = []; renderFunctionList(); draw(); setStatus("関数をすべて削除しました"); });
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const factor = event.deltaY < 0 ? 0.9 : 1.1;
  const rect = canvas.getBoundingClientRect();
  const cursorX = view[0] + (event.offsetX / rect.width) * (view[1] - view[0]);
  const cursorY = view[3] - (event.offsetY / rect.height) * (view[3] - view[2]);
  view = [cursorX + (view[0] - cursorX) * factor, cursorX + (view[1] - cursorX) * factor, cursorY + (view[2] - cursorY) * factor, cursorY + (view[3] - cursorY) * factor];
  syncFields(); draw();
}, { passive: false });
canvas.addEventListener("pointerdown", (event) => { dragStart = { x: event.clientX, y: event.clientY, view: [...view] }; canvas.setPointerCapture(event.pointerId); canvas.classList.add("dragging"); });
canvas.addEventListener("pointermove", (event) => {
  if (!dragStart) return;
  const rect = canvas.getBoundingClientRect();
  const dx = (event.clientX - dragStart.x) / rect.width * (dragStart.view[1] - dragStart.view[0]);
  const dy = (event.clientY - dragStart.y) / rect.height * (dragStart.view[3] - dragStart.view[2]);
  view = [dragStart.view[0] - dx, dragStart.view[1] - dx, dragStart.view[2] + dy, dragStart.view[3] + dy];
  syncFields(); draw();
});
canvas.addEventListener("pointerup", () => { dragStart = null; canvas.classList.remove("dragging"); });
canvas.addEventListener("pointercancel", () => { dragStart = null; canvas.classList.remove("dragging"); });
musicToggle.addEventListener("click", toggleMusic);
musicVolume.addEventListener("input", () => {
  if (masterGain) masterGain.gain.value = Number(musicVolume.value) / 100;
});
window.addEventListener("resize", draw);
functions.push({ label: "sin(x)", fn: compileExpression("sin(x)"), color: colors[0] });
renderFunctionList();
draw();
