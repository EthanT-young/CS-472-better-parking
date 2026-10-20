"use strict";

const $ = (sel) => document.querySelector(sel);

const CLASS_COLORS = { 2: "#22c55e", 3: "#f59e0b", 5: "#3b82f6", 7: "#ef4444" };
const colorFor = (classId) => CLASS_COLORS[classId] || "#a855f7";

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body && JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || res.statusText);
  return data;
}

/* ---------- Tabs ---------- */

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${tab.dataset.view}`));
    if (tab.dataset.view === "predict") render();
  });
});

/* ---------- Predict: state ---------- */

const state = {
  folder: null,
  parent: null,
  dirs: [],
  images: [],
  selected: null,   // image name in current folder
  image: null,      // loaded HTMLImageElement
  detections: null, // detections for the current image, in image pixel coordinates
  requestId: 0,
};

const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

/* ---------- Predict: folder browsing ---------- */

async function openFolder(path, { quiet = false } = {}) {
  try {
    const data = await api(`/api/browse?path=${encodeURIComponent(path)}`);
    Object.assign(state, { folder: data.path, parent: data.parent, dirs: data.dirs, images: data.images });
    $("#path-input").value = data.path;
    storage.set("folder", data.path);
    renderFileList();
    return true;
  } catch (err) {
    if (!quiet) alert(err.message);
    return false;
  }
}

function joinPath(folder, name) {
  return folder.endsWith("/") ? folder + name : `${folder}/${name}`;
}

function visibleImages() {
  const needle = $("#filter-input").value.toLowerCase();
  return state.images.filter((name) => name.toLowerCase().includes(needle));
}

function renderFileList() {
  const list = $("#file-list");
  list.innerHTML = "";
  for (const dir of state.dirs) {
    const li = document.createElement("li");
    li.className = "dir";
    li.textContent = dir;
    li.addEventListener("click", () => openFolder(joinPath(state.folder, dir)));
    list.appendChild(li);
  }
  const images = visibleImages();
  for (const name of images) {
    const li = document.createElement("li");
    li.textContent = name;
    li.dataset.name = name;
    li.classList.toggle("selected", name === state.selected);
    li.addEventListener("click", () => selectImage(name));
    list.appendChild(li);
  }
  $("#file-count").textContent = `${images.length} of ${state.images.length} images`;
}

$("#path-form").addEventListener("submit", (e) => {
  e.preventDefault();
  openFolder($("#path-input").value);
});
$("#up-btn").addEventListener("click", () => state.parent && openFolder(state.parent));
$("#filter-input").addEventListener("input", renderFileList);

// Arrow keys move through the image list when not typing in a field
document.addEventListener("keydown", (e) => {
  if (!$("#view-predict").classList.contains("active")) return;
  if (e.target.matches("input:not([type=checkbox]):not([type=range]), select")) return;
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const images = visibleImages();
  if (!images.length) return;
  e.preventDefault();
  const i = images.indexOf(state.selected);
  const next = e.key === "ArrowDown" ? Math.min(i + 1, images.length - 1) : Math.max(i - 1, 0);
  selectImage(images[next]);
});

/* ---------- Predict: image + inference ---------- */

function imagePath() {
  return joinPath(state.folder, state.selected);
}

function selectImage(name) {
  state.selected = name;
  state.detections = null;
  document.querySelectorAll("#file-list li[data-name]").forEach((li) => {
    const isSelected = li.dataset.name === name;
    li.classList.toggle("selected", isSelected);
    if (isSelected) li.scrollIntoView({ block: "nearest" });
  });
  $("#save-btn").disabled = true;
  setResult(name, "");

  const img = new Image();
  img.onload = () => {
    if (state.selected !== name) return;
    state.image = img;
    $("#stage-message").textContent = "";
    render();
    if ($("#auto-input").checked) runModel();
  };
  img.onerror = () => { $("#stage-message").textContent = `Could not load ${name}`; };
  img.src = `/api/image?path=${encodeURIComponent(imagePath())}`;
}

function selectedClasses() {
  return [...document.querySelectorAll(".classes input:checked")].map((el) => Number(el.value));
}

async function runModel() {
  if (!state.selected) return setResult("Select an image first", "");
  const classes = selectedClasses();
  if (!classes.length) return setResult("Select at least one vehicle class", "");

  // Only the latest request's response is shown (e.g. when arrowing through the list)
  const id = ++state.requestId;
  const name = state.selected;
  $("#run-btn").disabled = true;
  setResult(name, "Running model…");
  try {
    const data = await api("/api/predict", {
      method: "POST",
      body: {
        path: imagePath(),
        model: $("#model-input").value,
        classes,
        conf: Number($("#conf-input").value),
      },
    });
    if (id !== state.requestId) return;
    state.detections = data.detections;
    $("#save-btn").disabled = false;
    setResult(`${name} — ${data.count} vehicle${data.count === 1 ? "" : "s"} detected`, summarize(data.detections));
    render();
  } catch (err) {
    if (id === state.requestId) setResult(name, `Error: ${err.message}`);
  } finally {
    if (id === state.requestId) $("#run-btn").disabled = false;
  }
}

function summarize(detections) {
  const counts = {};
  for (const d of detections) counts[d.class_name] = (counts[d.class_name] || 0) + 1;
  return Object.entries(counts).sort().map(([n, c]) => `${n}: ${c}`).join(" · ");
}

function setResult(title, detail) {
  $("#result-title").textContent = title;
  $("#result-detail").textContent = detail;
}

function rerunIfAuto() {
  if ($("#auto-input").checked && state.image) runModel();
}

$("#run-btn").addEventListener("click", runModel);
$("#conf-input").addEventListener("input", (e) => { $("#conf-value").textContent = Number(e.target.value).toFixed(2); });
$("#conf-input").addEventListener("change", rerunIfAuto);
$("#model-input").addEventListener("change", rerunIfAuto);
document.querySelectorAll(".classes input").forEach((el) => el.addEventListener("change", rerunIfAuto));
$("#boxes-input").addEventListener("change", render);

/* ---------- Predict: drawing ---------- */

// Draws the image plus overlays. `scale` maps image pixels to canvas pixels.
function drawScene(context, scale, offsetX, offsetY) {
  const img = state.image;
  context.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
  if (state.detections && $("#boxes-input").checked) drawDetections(context, scale, offsetX, offsetY);
}

function drawDetections(context, scale, offsetX, offsetY) {
  const lineWidth = Math.max(2, Math.round(2 * scale * Math.max(1, state.image.width / 1000)));
  const fontSize = Math.max(12, Math.round(lineWidth * 6));
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.lineWidth = lineWidth;
  context.textBaseline = "top";

  for (const d of state.detections) {
    const [x1, y1, x2, y2] = d.bbox;
    const x = offsetX + x1 * scale;
    const y = offsetY + y1 * scale;
    const color = colorFor(d.class_id);
    context.strokeStyle = color;
    context.strokeRect(x, y, (x2 - x1) * scale, (y2 - y1) * scale);

    const label = `${d.class_name} ${d.confidence.toFixed(2)}`;
    const pad = fontSize * 0.25;
    const w = context.measureText(label).width + pad * 2;
    const h = fontSize + pad * 2;
    const ly = y - h < 0 ? y : y - h;
    context.fillStyle = color;
    context.fillRect(x - lineWidth / 2, ly, w, h);
    context.fillStyle = "#fff";
    context.fillText(label, x - lineWidth / 2 + pad, ly + pad);
  }
}

function render() {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth: w, clientHeight: h } = canvas;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!state.image) return;

  const img = state.image;
  const scale = Math.min(w / img.width, h / img.height);
  drawScene(ctx, scale, (w - img.width * scale) / 2, (h - img.height * scale) / 2);
}

new ResizeObserver(render).observe(canvas);

// Saves the annotated image at full resolution
$("#save-btn").addEventListener("click", () => {
  const out = document.createElement("canvas");
  out.width = state.image.width;
  out.height = state.image.height;
  drawScene(out.getContext("2d"), 1, 0, 0);
  out.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.selected.replace(/\.[^.]+$/, "") + "_annotated.png";
    a.click();
    URL.revokeObjectURL(a.href);
  }, "image/png");
});

/* ---------- Train / Test jobs ---------- */

// Applies carriage returns so tqdm progress bars update in place instead of repeating
function cleanLog(text) {
  return text.split("\n").map((line) => {
    const parts = line.split("\r").filter((p) => p.length);
    return parts.length ? parts[parts.length - 1] : "";
  }).join("\n");
}

function setupJob(section) {
  const name = section.dataset.job;
  const form = section.querySelector("form");
  const submit = form.querySelector("button[type=submit]");
  const stopBtn = section.querySelector(".stop-btn");
  const status = section.querySelector(".job-status");
  const logEl = section.querySelector(".log");
  let raw = "";
  let offset = 0;
  let timer = null;

  function update(data) {
    raw += data.log;
    offset = data.offset;
    const atBottom = logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 4;
    logEl.textContent = cleanLog(raw);
    if (atBottom) logEl.scrollTop = logEl.scrollHeight;

    submit.disabled = data.running;
    stopBtn.disabled = !data.running;
    status.textContent = data.running ? "Running…"
      : data.exit_code === null ? "Idle"
      : data.exit_code === 0 ? "Finished" : `Exited with code ${data.exit_code}`;

    clearTimeout(timer);
    if (data.running) timer = setTimeout(poll, 1000);
    else if (data.exit_code !== null) loadModels(); // new weights may exist now
  }

  async function poll() {
    try {
      update(await api(`/api/jobs/${name}?since=${offset}`));
    } catch (err) {
      status.textContent = `Lost connection: ${err.message}`;
      timer = setTimeout(poll, 3000);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    raw = "";
    offset = 0;
    try {
      update(await api(`/api/jobs/${name}`, { method: "POST", body: Object.fromEntries(new FormData(form)) }));
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  });

  stopBtn.addEventListener("click", async () => {
    status.textContent = "Stopping…";
    await api(`/api/jobs/${name}/stop`, { method: "POST" }).catch(() => {});
  });

  poll(); // pick up a job that was already running when the page loaded
}

document.querySelectorAll(".view.job").forEach(setupJob);

/* ---------- Init ---------- */

async function loadModels() {
  const models = await api("/api/models").catch(() => []);
  $("#model-options").innerHTML = models.map((m) => `<option value="${m}">`).join("");
}

loadModels();
(async () => {
  const last = storage.get("folder");
  if (!last || !(await openFolder(last, { quiet: true }))) openFolder(".");
})();
