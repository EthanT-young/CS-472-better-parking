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
  camera: null,     // camera layout and spot status from /api/camera-check, if a camera was used
  requestId: 0,
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
  clearTimeout(state.runTimer);
  state.selected = name;
  state.detections = null;
  state.camera = null;
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
    if ($("#auto-input").checked) scheduleRun();
  };
  img.onerror = () => { $("#stage-message").textContent = `Could not load ${name}`; };
  img.src = `/api/image?path=${encodeURIComponent(imagePath())}`;
}

function selectedClasses() {
  return [...document.querySelectorAll(".classes input:checked")].map((el) => Number(el.value));
}

// With a camera, vehicles outside its regions are excluded from the count and the boxes
function visibleDetections() {
  const classes = selectedClasses();
  const conf = Number($("#conf-input").value);
  return state.detections.filter((d) =>
    classes.includes(d.class_id) && d.confidence >= conf && (!state.camera || d.in_roi));
}

// The camera ID, if one is typed in the toolbar. Results are then checked against its regions.
function cameraId() {
  return $("#cam-predict-input").value.trim();
}

// With a camera, spots depend on the confidence and the classes checked, so both are in the key
function resultKey() {
  const camera = cameraId();
  if (!camera) return `${$("#model-input").value}|floor|${imagePath()}`;
  return `${$("#model-input").value}|${camera}|${$("#conf-input").value}|${selectedClasses().join(",")}|${imagePath()}`;
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
  if (!state.selected) return setResult("Select an image first", "");

  // Only the latest request's response is shown (e.g. when arrowing through the list)
  const id = ++state.requestId;
  const name = state.selected;
  const key = resultKey();
  const camera = cameraId();
  $("#run-btn").disabled = true;
  setResult(name, "Running model…");
  try {
    // With a camera, the check runs at the slider's confidence and the checked classes, so the
    // spot counts match what the slider and checkboxes show
    const body = {
      path: imagePath(),
      model: $("#model-input").value,
      classes: camera ? selectedClasses() : ALL_CLASSES,
      conf: camera ? Number($("#conf-input").value) : CONF_FLOOR,
    };
    const data = camera
      ? await api("/api/camera-check", { method: "POST", body: { ...body, camera_id: camera } })
      : await api("/api/predict", { method: "POST", body });
    state.results.delete(key);
    state.results.set(key, data);
    if (state.results.size > MAX_CACHED_RESULTS) state.results.delete(state.results.keys().next().value);
    if (id !== state.requestId) return;
    showDetections(data);
  } catch (err) {
    if (id === state.requestId) setResult(name, `Error: ${err.message}`);
  } finally {
    if (id === state.requestId) $("#run-btn").disabled = false;
  }
}

// `data` is a /api/predict or /api/camera-check response. `camera` is null for plain runs.
function showDetections(data) {
  state.detections = data.detections;
  state.camera = data.camera || null;
  $("#save-btn").disabled = false;
  refilter();
}

// Re-applies the confidence and class filters without rerunning the model
function refilter() {
  if (state.detections) {
    const shown = visibleDetections();
    const title = `${state.selected} — ${shown.length} vehicle${shown.length === 1 ? "" : "s"} detected`;
    setResult(title, cameraSummary(shown) || summarize(shown));
  }
  render();
}

// Camera line for the result bar: vehicles inside the regions and spot counts
function cameraSummary(shown) {
  if (!state.camera) return "";
  const inRoi = shown.filter((d) => d.in_roi).length;
  const { spots_total: total, occupied, free, unknown } = state.camera;
  const parts = [`${state.camera.camera_id}: ${inRoi} inside regions`];
  if (total) {
    const unknownText = unknown ? `, ${unknown} outside regions` : "";
    parts.push(`${occupied} of ${total} spots occupied, ${free} free${unknownText}`);
  }
  return parts.join(" · ");
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
  // Spot occupancy depends on confidence, so a camera check has to run again
  if (cameraId()) scheduleRun();
});
$("#model-input").addEventListener("change", () => {
  if ($("#auto-input").checked && state.image) scheduleRun();
});
$("#cam-predict-input").addEventListener("change", () => {
  if ($("#auto-input").checked && state.image) scheduleRun();
});
document.querySelectorAll(".classes input").forEach((el) => el.addEventListener("change", () => {
  refilter();
  // With a camera, the checked classes also decide the spot counts, so the check runs again
  if (cameraId()) scheduleRun();
}));
$("#boxes-input").addEventListener("change", render);

/* ---------- Predict: drawing ---------- */

// Draws the image plus overlays. `scale` maps image pixels to canvas pixels.
function drawScene(context, scale, offsetX, offsetY) {
  const img = state.image;
  context.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
  if (state.camera) drawCameraLayout(context, scale, offsetX, offsetY);
  if (state.detections && $("#boxes-input").checked) drawDetections(context, scale, offsetX, offsetY);
}

// Regions in cyan, spots green when free and red when occupied, numbered by spot id
function drawCameraLayout(context, scale, offsetX, offsetY) {
  const toCanvas = ([x, y]) => [offsetX + x * scale, offsetY + y * scale];
  const lineWidth = Math.max(2, Math.round(2 * scale * Math.max(1, state.image.width / 1000)));
  context.lineWidth = lineWidth;
  context.font = `600 ${Math.max(12, Math.round(lineWidth * 6))}px system-ui, sans-serif`;
  context.textBaseline = "top";

  const outline = (corners, color, dash) => {
    context.beginPath();
    corners.forEach((point, i) => {
      const [x, y] = toCanvas(point);
      if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
    context.setLineDash(dash);
    context.strokeStyle = color;
    context.stroke();
    context.setLineDash([]);
  };

  for (const roi of state.camera.rois) {
    outline(roi.corners, "#22d3ee", []);
    const [x, y] = toCanvas(roi.corners[0]);
    context.fillStyle = "#22d3ee";
    context.fillText(roi.name, x + 4, y + 4);
  }
  for (const spot of state.camera.spots) {
    // Grey when the spot is outside every region, so its status is unknown
    const color = spot.occupied === null ? "#9ca3af" : spot.occupied ? "#ef4444" : "#22c55e";
    outline(spot.corners, color, [8, 5]);
    const [x, y] = toCanvas(spot.corners[0]);
    context.fillStyle = color;
    context.fillText(String(spot.spot_id), x + 4, y + 4);
  }
}

function drawDetections(context, scale, offsetX, offsetY) {
  const lineWidth = Math.max(2, Math.round(2 * scale * Math.max(1, state.image.width / 1000)));
  const fontSize = Math.max(12, Math.round(lineWidth * 6));
  context.font = `600 ${fontSize}px system-ui, sans-serif`;
  context.lineWidth = lineWidth;
  context.textBaseline = "top";

  for (const d of visibleDetections()) {
    const [x1, y1, x2, y2] = d.bbox;
    const x = offsetX + x1 * scale;
    const y = offsetY + y1 * scale;
    // Vehicles outside the camera's regions are grey and dashed. Without a camera, all are inside.
    const inside = d.in_roi !== false;
    const color = inside ? colorFor(d.class_id) : "#9ca3af";
    context.strokeStyle = color;
    context.setLineDash(inside ? [] : [8, 6]);
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

/* ---------- Regions of interest ---------- */

// Regions are drawn in image pixels. Saved as 4 corners, so they match the camera config.
const roiCanvas = $("#roi-canvas");
const roiCtx = roiCanvas.getContext("2d");
const roiState = {
  camera: null,          // camera id that is loaded (may not have a config file yet)
  cameraImageSize: null, // [width, height] the camera's config was drawn at, or null
  image: null,           // HTMLImageElement
  mode: "region",        // "region" or "spot": what drawing adds and which list is shown
  spots: [],             // [{id, corners}]
  regions: [],           // [{name, corners}]
  drag: null,            // {x1, y1, x2, y2} while the pointer is down
  points: [],            // corners clicked so far for an angled region (up to 4)
};
const ROI_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7"];

function setRoiStatus(text, isError = false) {
  const el = $("#roi-status");
  el.textContent = text;
  el.style.color = isError ? "#ef4444" : "";
}

function roiTransform() {
  const img = roiState.image;
  const w = roiCanvas.clientWidth, h = roiCanvas.clientHeight;
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  return { scale, offsetX: (w - img.naturalWidth * scale) / 2, offsetY: (h - img.naturalHeight * scale) / 2 };
}

function roiPoint(event) {
  const rect = roiCanvas.getBoundingClientRect();
  const { scale, offsetX, offsetY } = roiTransform();
  const x = (event.clientX - rect.left - offsetX) / scale;
  const y = (event.clientY - rect.top - offsetY) / scale;
  return [
    Math.min(Math.max(x, 0), roiState.image.naturalWidth),
    Math.min(Math.max(y, 0), roiState.image.naturalHeight),
  ];
}

// Corners for an axis-aligned rectangle dragged from (x1, y1) to (x2, y2)
function rectCorners({ x1, y1, x2, y2 }) {
  const [left, right] = [Math.min(x1, x2), Math.max(x1, x2)];
  const [top, bottom] = [Math.min(y1, y2), Math.max(y1, y2)];
  return [[left, top], [right, top], [right, bottom], [left, bottom]];
}

function drawPolygon(corners, t, color, dash) {
  roiCtx.beginPath();
  corners.forEach(([x, y], i) => {
    const px = t.offsetX + x * t.scale;
    const py = t.offsetY + y * t.scale;
    if (i === 0) roiCtx.moveTo(px, py); else roiCtx.lineTo(px, py);
  });
  roiCtx.closePath();
  roiCtx.setLineDash(dash);
  roiCtx.strokeStyle = color;
  roiCtx.lineWidth = 2;
  roiCtx.stroke();
  roiCtx.setLineDash([]);
}

function drawLabel(text, x, y, color) {
  roiCtx.font = "600 13px system-ui, sans-serif";
  const width = roiCtx.measureText(text).width + 8;
  roiCtx.fillStyle = color;
  roiCtx.fillRect(x, y, width, 18);
  roiCtx.fillStyle = "#fff";
  roiCtx.fillText(text, x + 4, y + 13);
}

function renderRegions() {
  const dpr = window.devicePixelRatio || 1;
  const w = roiCanvas.clientWidth, h = roiCanvas.clientHeight;
  roiCanvas.width = Math.round(w * dpr);
  roiCanvas.height = Math.round(h * dpr);
  roiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  roiCtx.clearRect(0, 0, w, h);
  if (!roiState.image) return;

  const img = roiState.image;
  const t = roiTransform();
  roiCtx.drawImage(img, t.offsetX, t.offsetY, img.naturalWidth * t.scale, img.naturalHeight * t.scale);

  for (const spot of roiState.spots) {
    drawPolygon(spot.corners, t, "#22c55e", [8, 5]);
    const [x, y] = spot.corners[0];
    roiCtx.font = "600 13px system-ui, sans-serif";
    roiCtx.fillStyle = "#22c55e";
    roiCtx.fillText(String(spot.id), t.offsetX + x * t.scale + 4, t.offsetY + y * t.scale + 4);
  }
  roiState.regions.forEach((region, i) => {
    const color = ROI_COLORS[i % ROI_COLORS.length];
    drawPolygon(region.corners, t, color, []);
    const [x, y] = region.corners[0];
    drawLabel(region.name, t.offsetX + x * t.scale, t.offsetY + y * t.scale, color);
  });
  if (roiState.drag) drawPolygon(rectCorners(roiState.drag), t, "#ffffff", [6, 4]);
  if (roiState.points.length) {
    // Pending corners of an angled region: dots plus the edges drawn so far
    roiCtx.beginPath();
    roiState.points.forEach(([x, y], i) => {
      const px = t.offsetX + x * t.scale;
      const py = t.offsetY + y * t.scale;
      if (i === 0) roiCtx.moveTo(px, py); else roiCtx.lineTo(px, py);
    });
    roiCtx.strokeStyle = "#ffffff";
    roiCtx.lineWidth = 2;
    roiCtx.setLineDash([6, 4]);
    roiCtx.stroke();
    roiCtx.setLineDash([]);
    for (const [x, y] of roiState.points) {
      roiCtx.beginPath();
      roiCtx.arc(t.offsetX + x * t.scale, t.offsetY + y * t.scale, 5, 0, Math.PI * 2);
      roiCtx.fillStyle = "#ffffff";
      roiCtx.fill();
    }
  }
}

// Lists the regions or the spots, depending on the mode. Each row is editable.
function renderRegionList() {
  const list = $("#roi-list");
  list.replaceChildren();
  const spotMode = roiState.mode === "spot";
  const items = spotMode ? roiState.spots : roiState.regions;
  items.forEach((item, i) => {
    const row = document.createElement("li");
    const label = document.createElement("input");
    if (spotMode) {
      label.type = "number";
      label.min = "1";
      label.value = item.id;
      label.title = "Spot id (matches the database space_id)";
      label.addEventListener("input", () => { item.id = Number(label.value); renderRegions(); });
    } else {
      label.value = item.name;
      label.addEventListener("input", () => { item.name = label.value; renderRegions(); });
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = spotMode ? "Delete spot" : "Delete region";
    remove.addEventListener("click", () => {
      items.splice(i, 1);
      renderRegionList();
      renderRegions();
      updateRoiControls();
    });
    row.append(label, remove);
    list.append(row);
  });
}

function nextSpotId() {
  return roiState.spots.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;
}

function updateRoiControls() {
  const ready = roiState.camera && roiState.image;
  $("#roi-save-btn").disabled = !ready;
  $("#spot-save-btn").disabled = !ready;
  $("#mode-region-btn").classList.toggle("active", roiState.mode === "region");
  $("#mode-spot-btn").classList.toggle("active", roiState.mode === "spot");
  $("#roi-message").textContent = roiState.image ? "" : "Load a camera, then choose an image.";
}

async function loadCamera() {
  const id = $("#cam-input").value.trim();
  if (!id) return;
  try {
    const cam = await api(`/api/cameras/${encodeURIComponent(id)}`);
    roiState.camera = id;
    roiState.cameraImageSize = cam.image_size;
    roiState.spots = cam.spots.map((s) => ({ id: s.id, corners: s.corners }));
    roiState.regions = cam.rois.map((r) => ({ name: r.name, corners: r.corners }));
    renderRegionList();
    renderRegions();
    updateRoiControls();
    setRoiStatus(cam.exists
      ? `Loaded ${cam.spots.length} spot(s) and ${cam.rois.length} region(s).`
      : "New camera. Saving will create its config file.");
  } catch (err) {
    setRoiStatus(err.message, true);
  }
}

function useSelectedImage() {
  if (!state.selected) {
    setRoiStatus("Select an image in Predict first.", true);
    return;
  }
  const path = imagePath();
  const img = new Image();
  img.onload = () => {
    roiState.image = img;
    const size = [img.naturalWidth, img.naturalHeight];
    $("#cam-image").textContent = `${state.selected} (${size[0]}×${size[1]})`;
    if (roiState.cameraImageSize && roiState.cameraImageSize.join("x") !== size.join("x")) {
      setRoiStatus(`Warning: the camera config is for ${roiState.cameraImageSize.join("×")}, not ${size.join("×")}.`, true);
    }
    renderRegions();
    updateRoiControls();
  };
  img.onerror = () => setRoiStatus(`Could not load ${state.selected}.`, true);
  img.src = `/api/image?path=${encodeURIComponent(path)}`;
}

async function saveRegions() {
  const img = roiState.image;
  const rois = roiState.regions.map((r, i) => ({
    name: r.name.trim() || `region-${i + 1}`,
    corners: r.corners.map(([x, y]) => [Math.round(x), Math.round(y)]),
  }));
  try {
    const res = await api(`/api/cameras/${encodeURIComponent(roiState.camera)}/rois`, {
      method: "PUT",
      body: { image_size: [img.naturalWidth, img.naturalHeight], rois },
    });
    setRoiStatus(`Saved ${res.rois.length} region(s) to ${res.camera_id}.`);
  } catch (err) {
    setRoiStatus(`Not saved: ${err.message}`, true);
  }
}

async function saveSpots() {
  const img = roiState.image;
  const spots = roiState.spots.map((s) => ({
    id: Number(s.id),
    corners: s.corners.map(([x, y]) => [Math.round(x), Math.round(y)]),
  }));
  try {
    const res = await api(`/api/cameras/${encodeURIComponent(roiState.camera)}/spots`, {
      method: "PUT",
      body: { image_size: [img.naturalWidth, img.naturalHeight], spots },
    });
    setRoiStatus(`Saved ${res.spots.length} spot(s) to ${res.camera_id}.`);
  } catch (err) {
    setRoiStatus(`Not saved: ${err.message}`, true);
  }
}

// Switches what drawing adds: regions or spots
function setRoiMode(mode) {
  roiState.mode = mode;
  roiState.points = [];
  setRoiStatus(mode === "spot" ? "Spot mode: drawing adds a spot with the next id." : "Region mode: drawing adds a region.");
  renderRegionList();
  renderRegions();
  updateRoiControls();
}

roiCanvas.addEventListener("pointerdown", (event) => {
  if (!roiState.image) return;
  const [x, y] = roiPoint(event);
  roiState.drag = { x1: x, y1: y, x2: x, y2: y };
  roiCanvas.setPointerCapture(event.pointerId);
  renderRegions();
});

roiCanvas.addEventListener("pointermove", (event) => {
  if (!roiState.drag) return;
  const [x, y] = roiPoint(event);
  Object.assign(roiState.drag, { x2: x, y2: y });
  renderRegions();
});

roiCanvas.addEventListener("pointerup", () => {
  const drag = roiState.drag;
  roiState.drag = null;
  // Compare in screen pixels, so a small jitter on a large photo still counts as a click
  const screenScale = drag ? roiTransform().scale : 1;
  if (drag && Math.abs(drag.x2 - drag.x1) * screenScale >= 5 && Math.abs(drag.y2 - drag.y1) * screenScale >= 5) {
    // A drag makes an axis-aligned rectangle
    roiState.points = [];
    addRegion(rectCorners(drag));
  } else if (drag) {
    // A click adds one corner. The fourth corner completes an angled region.
    roiState.points.push([drag.x1, drag.y1]);
    if (roiState.points.length === 4) {
      const corners = roiState.points;
      roiState.points = [];
      addRegion(corners);
    } else {
      setRoiStatus(`${roiState.points.length} of 4 corners. Esc cancels.`);
    }
  }
  renderRegions();
  updateRoiControls();
});

// Adds a region if its corners form a convex shape. The server rejects other shapes.
function addRegion(corners) {
  if (!isConvexQuad(corners)) {
    setRoiStatus("Those corners don't form a convex shape. Click the four corners in order around the spot.", true);
    return false;
  }
  if (roiState.mode === "spot") {
    roiState.spots.push({ id: nextSpotId(), corners });
  } else {
    roiState.regions.push({ name: `region ${roiState.regions.length + 1}`, corners });
  }
  renderRegionList();
  setRoiStatus("");
  return true;
}

// True when all turns of the quadrilateral go the same way (no crossed or flat corners)
function isConvexQuad(c) {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [a, b, d] = [c[i], c[(i + 1) % 4], c[(i + 2) % 4]];
    const cross = (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && roiState.points.length) {
    roiState.points = [];
    setRoiStatus("");
    renderRegions();
  }
});

$("#cam-load-btn").addEventListener("click", loadCamera);
$("#cam-input").addEventListener("keydown", (event) => { if (event.key === "Enter") loadCamera(); });
$("#use-image-btn").addEventListener("click", useSelectedImage);
$("#mode-region-btn").addEventListener("click", () => setRoiMode("region"));
$("#mode-spot-btn").addEventListener("click", () => setRoiMode("spot"));
$("#spot-save-btn").addEventListener("click", saveSpots);
$("#roi-clear-btn").addEventListener("click", () => {
  if (roiState.mode === "spot") roiState.spots = [];
  else roiState.regions = [];
  roiState.points = [];
  renderRegionList();
  renderRegions();
  updateRoiControls();
});
$("#roi-save-btn").addEventListener("click", saveRegions);
new ResizeObserver(renderRegions).observe(roiCanvas);

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
