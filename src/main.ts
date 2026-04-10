import "./style.css";

// ── Constants ─────────────────────────────────────────────

const ZOOM_MIN = 0.02;
const ZOOM_MAX = 64;
const ZOOM_STEP = 0.12; // wheel sensitivity
const ZOOM_BTN_FAC = 1.25; // factor per button click

// ── State ─────────────────────────────────────────────────

const state = {
  scale: 1,
  tx: 0, // translation x (px)
  ty: 0, // translation y (py)
  imgW: 0,
  imgH: 0,
  imageLoaded: false,
};

// ── DOM refs ──────────────────────────────────────────────

const canvas = document.getElementById("canvas");
const stage = document.getElementById("stage");
const zoomLabel = document.getElementById("zoom-label");
const fileLabel = document.getElementById("file-label");
const dropOverlay = document.getElementById("drop-overlay");
const fileInput = document.getElementById("file-input");

// ── Transform apply ───────────────────────────────────────

function applyTransform() {
  stage.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
  zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
}

// ── Fit image to viewport ─────────────────────────────────

function fitToViewport(animated = false) {
  if (!state.imageLoaded) return;

  const vw = canvas.clientWidth;
  const vh = canvas.clientHeight;
  const padding = 48;

  const scaleX = (vw - padding * 2) / state.imgW;
  const scaleY = (vh - padding * 2) / state.imgH;
  const scale = Math.min(scaleX, scaleY, 1);

  state.scale = scale;
  state.tx = (vw - state.imgW * scale) / 2;
  state.ty = (vh - state.imgH * scale) / 2;

  if (animated) {
    stage.style.transition = "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    applyTransform();
    stage.addEventListener(
      "transitionend",
      () => {
        stage.style.transition = "";
      },
      { once: true },
    );
  } else {
    applyTransform();
  }
}

// ── Zoom around a point ───────────────────────────────────

/**
 * Zoom toward (cx, cy) which are coordinates relative to
 * the canvas element (not the page).
 */
function zoomAround(cx, cy, factor) {
  const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, state.scale * factor));
  const ratio = newScale / state.scale;

  state.tx = cx - ratio * (cx - state.tx);
  state.ty = cy - ratio * (cy - state.ty);
  state.scale = newScale;

  applyTransform();
}

// ── Load image ────────────────────────────────────────────

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const url = URL.createObjectURL(file);
  const img = new Image();

  img.alt = file.name;

  img.addEventListener("load", () => {
    state.imgW = img.naturalWidth;
    state.imgH = img.naturalHeight;
    state.imageLoaded = true;

    // Remove previous image if any
    stage.replaceChildren(img);

    URL.revokeObjectURL(url);

    dropOverlay.classList.add("hidden");
    fileLabel.innerHTML = `<span>${file.name}</span>`;
    canvas.setAttribute("data-state", "grab");

    fitToViewport();
  });

  img.addEventListener("error", () => {
    URL.revokeObjectURL(url);
    alert("Could not load this image.");
  });

  img.src = url;
}

// ── Pointer pan ───────────────────────────────────────────

let pointerOrigin = null;
let panStart = { tx: 0, ty: 0 };

canvas.addEventListener("pointerdown", (event) => {
  if (!state.imageLoaded) return;
  if (event.button !== 0) return;

  // Prevent text selection during drag
  event.preventDefault();

  canvas.setPointerCapture(event.pointerId);
  canvas.setAttribute("data-state", "grabbing");

  pointerOrigin = { x: event.clientX, y: event.clientY };
  panStart = { tx: state.tx, ty: state.ty };
});

canvas.addEventListener("pointermove", (event) => {
  if (pointerOrigin === null) return;

  const dx = event.clientX - pointerOrigin.x;
  const dy = event.clientY - pointerOrigin.y;

  state.tx = panStart.tx + dx;
  state.ty = panStart.ty + dy;

  applyTransform();
});

const stopPan = () => {
  if (pointerOrigin === null) return;
  pointerOrigin = null;
  if (state.imageLoaded) {
    canvas.setAttribute("data-state", "grab");
  }
};

canvas.addEventListener("pointerup", stopPan);
canvas.addEventListener("pointercancel", stopPan);

// ── Scroll wheel zoom ─────────────────────────────────────

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;

    // Normalise delta across browsers / trackpads
    const delta =
      event.deltaMode === 1
        ? event.deltaY * 20 // line mode
        : event.deltaY; // pixel mode

    // Pinch gesture on trackpad sends ctrlKey=true with precise deltas
    const factor = event.ctrlKey
      ? 1 - delta * 0.01 // pinch — more sensitive
      : 1 - delta * ZOOM_STEP * 0.01;

    zoomAround(cx, cy, factor);
  },
  { passive: false },
);

// ── Button controls ───────────────────────────────────────

document.getElementById("btn-open").addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length > 0) {
    loadFile(fileInput.files[0]);
    fileInput.value = ""; // allow re-opening same file
  }
});

document.getElementById("btn-fit").addEventListener("click", () => {
  fitToViewport(true);
});

document.getElementById("btn-1x").addEventListener("click", () => {
  if (!state.imageLoaded) return;
  const vw = canvas.clientWidth;
  const vh = canvas.clientHeight;
  state.scale = 1;
  state.tx = (vw - state.imgW) / 2;
  state.ty = (vh - state.imgH) / 2;
  stage.style.transition = "transform 0.2s ease";
  applyTransform();
  stage.addEventListener(
    "transitionend",
    () => {
      stage.style.transition = "";
    },
    { once: true },
  );
});

document.getElementById("btn-zoom-in").addEventListener("click", () => {
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  zoomAround(cx, cy, ZOOM_BTN_FAC);
});

document.getElementById("btn-zoom-out").addEventListener("click", () => {
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  zoomAround(cx, cy, 1 / ZOOM_BTN_FAC);
});

// ── Keyboard shortcuts ────────────────────────────────────

window.addEventListener("keydown", (event) => {
  // Don't fire shortcuts when focus is inside an input
  if (event.target.matches("input, textarea, select")) return;

  switch (event.key.toLowerCase()) {
    case "f":
      fitToViewport(true);
      break;

    case "1":
      document.getElementById("btn-1x").click();
      break;

    case "+":
    case "=": {
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      zoomAround(cx, cy, ZOOM_BTN_FAC);
      break;
    }

    case "-": {
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      zoomAround(cx, cy, 1 / ZOOM_BTN_FAC);
      break;
    }
  }
});

// ── Drag & drop ───────────────────────────────────────────

canvas.addEventListener("dragover", (event) => {
  event.preventDefault();
  canvas.classList.add("drag-active");
});

canvas.addEventListener("dragleave", (event) => {
  // Only react to leaving the canvas itself, not child elements
  if (!canvas.contains(event.relatedTarget)) {
    canvas.classList.remove("drag-active");
  }
});

canvas.addEventListener("drop", (event) => {
  event.preventDefault();
  canvas.classList.remove("drag-active");

  const file = event.dataTransfer.files[0];
  if (file) loadFile(file);
});

// ── Resize: re-fit if canvas changes size ─────────────────

const resizeObserver = new ResizeObserver(() => {
  if (state.imageLoaded) {
    // Don't re-fit aggressively — only on first load.
    // After that the user controls the viewport.
  }
});

resizeObserver.observe(canvas);

// ── Initial state ─────────────────────────────────────────

applyTransform();
