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
  detections: null, // all detections for the current image, in image pixel coordinates
  requestId: 0,
  imageId: 0,
  folderId: 0,
  spotCheckId: 0,
  spotTimer: null,
  spots: [],
  configuredSpots: [],
  spotStatuses: null,
  spotRevision: 0,
  runTimer: null,
  results: new Map(), // "model|path" -> detections, so revisiting an image doesn't rerun the model
};

// The model runs once per image at the slider's minimum confidence with every class.
// Moving the slider or toggling classes then only filters those results in the browser.
const CONF_FLOOR = Number($("#conf-input").min);
const ALL_CLASSES = [...document.querySelectorAll(".classes input")].map((el) => Number(el.value));
const MAX_CACHED_RESULTS = 500;

const canvas = $("#canvas");
const ctx = canvas.getContext("2d");

/* ---------- Predict: folder browsing ---------- */

async function openFolder(path, { quiet = false } = {}) {
  const id = ++state.folderId;
  try {
    const data = await api(`/api/browse?path=${encodeURIComponent(path)}`);
    if (id !== state.folderId) return false;
    if (state.folder !== data.path) {
      invalidatePrediction();
      state.imageId++;
      state.selected = null;
      state.image = null;
      $("#stage-message").textContent = "Select an image from the sidebar.";
      setResult("No image selected", "");
      render();
    }
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
  if (e.target.matches("input:not([type=checkbox]):not([type=range]), select, textarea")) return;
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

function invalidateSpots() {
  clearTimeout(state.spotTimer);
  state.spotCheckId++;
  state.spotStatuses = null;
  $("#spot-status").textContent = "";
  renderSpots();
}

function invalidatePrediction() {
  clearTimeout(state.runTimer);
  state.requestId++;
  state.detections = null;
  $("#run-btn").disabled = false;
  $("#save-btn").disabled = true;
  invalidateSpots();
}

function selectImage(name) {
  invalidatePrediction();
  const id = ++state.imageId;
  state.selected = name;
  state.image = null;
  renderFileList();
  const selected = [...document.querySelectorAll("#file-list li[data-name]")].find((li) => li.dataset.name === name);
  if (selected) selected.scrollIntoView({ block: "nearest" });
  setResult(name, "Loading image…");
  $("#stage-message").textContent = "Loading image…";
  render();

  const img = new Image();
  img.onload = () => {
    if (id !== state.imageId) return;
    state.image = img;
    $("#stage-message").textContent = "";
    setResult(name, `${img.naturalWidth} × ${img.naturalHeight} pixels`);
    render();
    if ($("#auto-input").checked) scheduleRun();
  };
  img.onerror = () => {
    if (id === state.imageId) $("#stage-message").textContent = `Could not load ${name}`;
  };
  img.src = `/api/image?path=${encodeURIComponent(imagePath())}`;
}

function selectedClasses() {
  return [...document.querySelectorAll(".classes input:checked")].map((el) => Number(el.value));
}

function visibleDetections() {
  const classes = selectedClasses();
  const conf = Number($("#conf-input").value);
  return (state.detections || []).filter((d) => classes.includes(d.class_id) && d.confidence >= conf);
}

function resultKey() {
  return `${$("#model-input").value}|${imagePath()}`;
}

// Shows saved results right away; otherwise waits briefly so arrowing quickly
// through the list only runs the model on the image you stop on
function scheduleRun() {
  clearTimeout(state.runTimer);
  const saved = state.results.get(resultKey());
  if (saved) return showDetections(saved);
  state.runTimer = setTimeout(runModel, 150);
}

// Always runs the model, so the Run button also refreshes saved results
async function runModel() {
  clearTimeout(state.runTimer);
  if (!state.selected || !state.image) return setResult("Select a loaded image first", "");
  invalidatePrediction();
  render();

  // Only the latest request's response is shown (e.g. when arrowing through the list)
  const id = ++state.requestId;
  const name = state.selected;
  const key = resultKey();
  $("#run-btn").disabled = true;
  setResult(name, "Running model…");
  try {
    const data = await api("/api/predict", {
      method: "POST",
      body: {
        path: imagePath(),
        model: $("#model-input").value,
        classes: ALL_CLASSES,
        conf: CONF_FLOOR,
      },
    });
    state.results.delete(key);
    state.results.set(key, data.detections);
    if (state.results.size > MAX_CACHED_RESULTS) state.results.delete(state.results.keys().next().value);
    if (id !== state.requestId || key !== resultKey()) return;
    showDetections(data.detections);
  } catch (err) {
    if (id === state.requestId) setResult(name, `Error: ${err.message}`);
  } finally {
    if (id === state.requestId) $("#run-btn").disabled = false;
  }
}

function showDetections(detections) {
  state.detections = detections;
  refilter();
}

// Re-applies the confidence and class filters without rerunning the model
function refilter() {
  if (state.detections) {
    const shown = visibleDetections();
    setResult(`${state.selected} — ${shown.length} vehicle${shown.length === 1 ? "" : "s"} detected`, summarize(shown));
  }
  $("#save-btn").disabled = !state.image || state.detections === null;
  refreshSpots();
  render();
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

$("#run-btn").addEventListener("click", runModel);
$("#conf-input").addEventListener("input", (e) => {
  $("#conf-value").textContent = Number(e.target.value).toFixed(2);
  refilter();
});
$("#model-input").addEventListener("input", () => {
  invalidatePrediction();
  render();
  if (state.selected) setResult(state.selected, "Model changed; run to update.");
});
$("#model-input").addEventListener("change", () => {
  if ($("#auto-input").checked && state.image) scheduleRun();
});
document.querySelectorAll(".classes input").forEach((el) => el.addEventListener("change", refilter));
$("#boxes-input").addEventListener("change", render);
$("#centers-input").addEventListener("change", render);

/* ---------- Predict: drawing ---------- */

// Draws the image plus overlays. `scale` maps image pixels to canvas pixels.
function drawScene(context, scale, offsetX, offsetY) {
  const img = state.image;
  context.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
  if (state.detections && ($("#boxes-input").checked || $("#centers-input").checked)) {
    drawDetections(context, scale, offsetX, offsetY);
  }
  if ($("#spots-input").checked) drawSpots(context, scale, offsetX, offsetY);
}

function drawDetections(context, scale, offsetX, offsetY) {
  const lineWidth = Math.max(2, Math.round(2 * scale * Math.max(1, state.image.width / 1000)));
  const fontSize = Math.max(12, Math.round(lineWidth * 6));
  const pad = fontSize * 0.25;
  const h = fontSize + pad * 2;
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "top";

  // White text on a colored background, with its top-left corner at (x, y)
  const tag = (text, x, y, color) => {
    context.fillStyle = color;
    context.fillRect(x, y, context.measureText(text).width + pad * 2, h);
    context.fillStyle = "#fff";
    context.fillText(text, x + pad, y + pad);
  };

  const detections = visibleDetections();
  if ($("#boxes-input").checked) {
    context.lineWidth = lineWidth;
    for (const d of detections) {
      const [x1, y1, x2, y2] = d.bbox;
      const x = offsetX + x1 * scale;
      const y = offsetY + y1 * scale;
      const color = colorFor(d.class_id);
      context.strokeStyle = color;
      context.strokeRect(x, y, (x2 - x1) * scale, (y2 - y1) * scale);
      tag(`${d.class_name} ${d.confidence.toFixed(2)}`, x - lineWidth / 2, y - h < 0 ? y : y - h, color);
    }
  }

  // Middle of each box's bottom edge, drawn after all boxes so no box covers it.
  // Coordinates are in original image pixels.
  if ($("#centers-input").checked) {
    const radius = lineWidth * 2;
    const right = offsetX + state.image.width * scale;
    const bottom = offsetY + state.image.height * scale;
    context.lineWidth = Math.max(1, lineWidth / 2);
    for (const d of detections) {
      const [cx, cy] = d.bottom_center;
      const x = offsetX + cx * scale;
      const y = offsetY + cy * scale;
      const color = colorFor(d.class_id);
      context.beginPath();
      context.arc(x, y, radius, 0, 2 * Math.PI);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = "#fff";
      context.stroke();

      // Coordinates go right of the dot, or left of it when they would run off the image.
      // Boxes often touch the bottom of the photo, so keep the label above the image's edge.
      const text = `(${cx}, ${cy})`;
      const w = context.measureText(text).width + pad * 2;
      const tx = x + radius + pad + w <= right ? x + radius + pad : x - radius - pad - w;
      tag(text, tx, Math.min(y - h / 2, bottom - h), color);
    }
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

// Saves the current view (image, boxes, centers, spot points) at full resolution.
$("#save-btn").addEventListener("click", () => {
  if (!state.image || state.detections === null) return;
  const out = document.createElement("canvas");
  out.width = state.image.width;
  out.height = state.image.height;
  const name = state.selected.replace(/\.[^.]+$/, "") + "_annotated.png";
  drawScene(out.getContext("2d"), 1, 0, 0);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    download(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});

function download(url, name) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

/* ---------- Parking spots ---------- */

// Asks the server which spot points are inside the boxes currently shown (the same
// check_parking_spots() as predict.py), without rerunning the model.
function refreshSpots() {
  invalidateSpots();
  if (!state.image || state.detections === null) return;
  const id = state.spotCheckId;
  state.spotTimer = setTimeout(async () => {
    try {
      const data = await api("/api/spots/check", {
        method: "POST",
        body: {
          width: state.image.naturalWidth,
          height: state.image.naturalHeight,
          detections: visibleDetections(),
          spots: state.spots,
        },
      });
      if (id !== state.spotCheckId) return;
      state.spotStatuses = data.spots;
      renderSpots();
      render();
    } catch (err) {
      if (id === state.spotCheckId) $("#spot-status").textContent = `Spot check error: ${err.message}`;
    }
  }, 120);
}

function statusFor(spot) {
  if (!state.spotStatuses) return {label: "Pending", kind: "pending", color: "#94a3b8"};
  const status = state.spotStatuses.find((s) => s.spot_number === spot.spot_number);
  if (!status || status.occupied === null) return {label: "Unknown (outside image)", kind: "unknown", color: "#94a3b8"};
  return status.occupied ? {label: "Occupied", kind: "occupied", color: "#ef4444"}
    : {label: "Empty", kind: "empty", color: "#16a34a"};
}

function renderSpots() {
  const list = $("#spot-list");
  list.replaceChildren();
  if (!state.spots.length) {
    const empty = document.createElement("span");
    empty.className = "muted";
    empty.textContent = "No points yet. Choose a spot number and click the image.";
    list.appendChild(empty);
  }
  for (const spot of state.spots) {
    const row = document.createElement("div");
    row.className = "spot-row";
    const text = document.createElement("span");
    text.textContent = `Spot ${spot.spot_number} · (${spot.coordinate.join(", ")})`;
    const status = statusFor(spot);
    const badge = document.createElement("span");
    badge.className = `spot-state ${status.kind}`;
    badge.textContent = status.label;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove spot ${spot.spot_number}`);
    remove.addEventListener("click", () => {
      state.spots = state.spots.filter((s) => s.spot_number !== spot.spot_number);
      state.spotRevision++;
      $("#copy-status").textContent = "";
      refreshSpots();
      render();
    });
    row.append(text, badge, remove);
    list.appendChild(row);
  }
  $("#spot-code").value = "PARKING_SPOTS = [\n" + state.spots.map((s) =>
    `    ParkingSpot(spot_number=${s.spot_number}, coordinate=(${s.coordinate[0]}, ${s.coordinate[1]})),`
  ).join("\n") + "\n]";
}

function drawSpots(context, scale, offsetX, offsetY) {
  const fontSize = Math.max(12, Math.round(16 * scale * Math.max(1, state.image.width / 1000)));
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.textBaseline = "top";
  for (const spot of state.spots) {
    const [px, py] = spot.coordinate;
    if (px < 0 || py < 0 || px >= state.image.width || py >= state.image.height) continue;
    const status = statusFor(spot);
    const x = offsetX + px * scale, y = offsetY + py * scale;
    const radius = Math.max(5, fontSize / 3);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = status.color;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "white";
    context.stroke();
    const text = `Spot ${spot.spot_number}: ${status.label}`;
    const width = context.measureText(text).width + 8;
    const tx = Math.max(offsetX, Math.min(x + radius + 5, offsetX + state.image.width * scale - width));
    const ty = Math.max(offsetY, y - fontSize - radius - 7);
    context.fillStyle = "rgba(0,0,0,0.8)";
    context.fillRect(tx, ty, width, fontSize + 6);
    context.fillStyle = status.color;
    context.fillText(text, tx + 4, ty + 3);
  }
}

canvas.addEventListener("click", (event) => {
  if (!state.image || !$("#place-spot").checked) return;
  const field = $("#spot-number");
  const number = Number(field.value);
  if (!field.reportValidity() || !Number.isSafeInteger(number) || number < 1) return;
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / state.image.width, rect.height / state.image.height);
  if (scale <= 0) return;
  const x = Math.floor((event.clientX - rect.left - (rect.width - state.image.width * scale) / 2) / scale);
  const y = Math.floor((event.clientY - rect.top - (rect.height - state.image.height * scale) / 2) / scale);
  if (x < 0 || y < 0 || x >= state.image.width || y >= state.image.height) return;
  const spot = {spot_number: number, coordinate: [x, y]};
  const i = state.spots.findIndex((s) => s.spot_number === number);
  if (i >= 0) state.spots[i] = spot;
  else state.spots.push(spot);
  state.spots.sort((a, b) => a.spot_number - b.spot_number);
  state.spotRevision++;
  $("#copy-status").textContent = "";
  refreshSpots();
  render();
});

$("#reset-spots").addEventListener("click", () => {
  state.spots = state.configuredSpots.map((s) => ({...s, coordinate: [...s.coordinate]}));
  state.spotRevision++;
  $("#copy-status").textContent = "";
  refreshSpots();
  render();
});
$("#copy-spots").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#spot-code").value);
    $("#copy-status").textContent = "Copied. Paste into PARKING_SPOTS in predict.py.";
  } catch {
    $("#spot-code").focus();
    $("#spot-code").select();
    $("#copy-status").textContent = "Text selected. Copy it with your keyboard.";
  }
});
$("#spots-input").addEventListener("change", render);
$("#place-spot").addEventListener("change", () => $("#stage").classList.toggle("placing", $("#place-spot").checked));
$("#stage").classList.toggle("placing", $("#place-spot").checked);

async function loadSpots() {
  try {
    const data = await api("/api/spots");
    state.configuredSpots = data.spots;
    if (state.spotRevision === 0) {
      state.spots = data.spots.map((s) => ({...s, coordinate: [...s.coordinate]}));
      refreshSpots();
      render();
    }
  } catch (err) {
    $("#copy-status").textContent = `Could not load configured spots: ${err.message}`;
  }
  renderSpots();
}

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
loadSpots();
renderSpots();
(async () => {
  const last = storage.get("folder");
  if (!last || !(await openFolder(last, { quiet: true }))) openFolder(".");
})();
