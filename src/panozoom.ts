import "./style.css";

export class PanoZoomApp extends HTMLElement {
  static readonly #ZOOM_STEP = 0.12; // wheel sensitivity
  static readonly #ZOOM_MAX = 64;
  static readonly #ZOOM_MIN = 0.02;
  static readonly #ZOOM_BTN_FAC = 1.25; // factor per button click

  #canvas: HTMLElement | null = null;
  #abortController: AbortController | null = null;
  #stage: HTMLDivElement | null = null;

  #state = {
    scale: 1,
    tx: 0, // translation x (px)
    ty: 0, // translation y (py)
    imgW: 0,
    imgH: 0,
    imageLoaded: false,
  };

  constructor() {
    super();
  }

  connectedCallback() {
    this.#addEventListeners();
    this.#applyTransform();
  }

  disconnectedCallback() {
    // cleans up all listeners in one go
    this.#abortController?.abort();
  }

  #applyTransform = () => {
    const zoomLabel: HTMLSpanElement | null = this.querySelector("#zoom-label");
    this.#stage = this.querySelector(".stage");

    if (!zoomLabel || !this.#stage) {
      throw new Error("Zoom label or stage not found");
    }

    this.#stage.style.transform = `translate(${this.#state.tx}px, ${this.#state.ty}px) scale(${this.#state.scale})`;
    zoomLabel.textContent = `${Math.round(this.#state.scale * 100)}%`;
  };

  #fitToViewport = (animated = false) => {
    if (!this.#state.imageLoaded || !this.#canvas) {
      throw new Error("Image not loaded or canvas not found");
    }

    const vw = this.#canvas.clientWidth;
    const vh = this.#canvas.clientHeight;
    const padding = 48;

    /*
    Subtracting the padding from both sides gives the available space for
    the current dimension. Dividing the result by the image's natural size
    in the same dimension gives us the scale factor which will ensure the
    image fits the available space.
    */
    const scaleX = (vw - padding * 2) / this.#state.imgW;
    const scaleY = (vh - padding * 2) / this.#state.imgH;
    /*
    Pick the axis with the tightest constraint to ensure the image fits
    in both dimensions. This is the same principle as object-fit: contain.
    */
    const scale = Math.min(scaleX, scaleY, 1);

    this.#state.scale = scale;
    // `this.#state.imgW * scale` is the image's rendered width after scaling.
    // Subtracting this from the available canvas width gives us the leftover
    // horizontal space. Dividing by 2 gives us the left and right margins.
    // The same logic applies to the vertical dimension. This is the
    // translation needed to center the image. This is the same
    // principle as margin: auto.
    this.#state.tx = (vw - this.#state.imgW * scale) / 2;
    this.#state.ty = (vh - this.#state.imgH * scale) / 2;

    if (animated && this.#stage) {
      // local const — TypeScript can trust this won't change
      const stage = this.#stage;
      stage.style.transition = "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)";

      this.#applyTransform();

      stage.addEventListener(
        "transitionend",
        () => {
          // narrowing now also holds here
          stage.style.transition = "";
        },
        { once: true },
      );
    } else {
      this.#applyTransform();
    }
  };

  #loadFile = (file: File) => {
    if (!file || !file.type.startsWith("image/") || !this.#stage) {
      throw new Error("Invalid file or stage not found");
    }

    const dropOverlay = this.querySelector("#drop-overlay");
    const fileLabel = this.querySelector("#file-label");
    const stage = this.#stage;
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.alt = file.name;

    img.addEventListener("load", () => {
      this.#state.imgW = img.naturalWidth;
      this.#state.imgH = img.naturalHeight;
      this.#state.imageLoaded = true;

      stage.replaceChildren(img);

      URL.revokeObjectURL(url);

      this.#canvas?.classList.remove("drag-active");
      dropOverlay?.classList.add("hidden");
      this.#canvas?.setAttribute("data-state", "grab");

      if (fileLabel) {
        fileLabel.innerHTML = `<span>${file.name}</span>`;
      }

      this.#fitToViewport();
    });

    img.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      alert("Could not load this image.");
    });

    img.src = url;
  };

  #handleCanvasEvents = (signal: AbortSignal) => {
    this.#canvas = this.querySelector("#canvas");

    if (!this.#canvas) {
      throw new Error("Canvas not found");
    }

    this.#canvas.addEventListener("dragover", (event: DragEvent) => {
      event.preventDefault();
      this.#canvas?.classList.add("drag-active");
    }, { signal });

    this.#canvas.addEventListener("dragleave", (event: DragEvent) => {
      // @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/relatedTarget
      if (!this.#canvas?.contains(event.relatedTarget as Node)) {
        this.#canvas?.classList.remove("drag-active");
      }
    }, { signal });

    this.#canvas.addEventListener("drop", (event: DragEvent) => {
      event.preventDefault();
      this.#canvas?.classList.remove("drag-active");

      const file = event.dataTransfer?.files[0];
      if (file) {
        this.#loadFile(file);
      }
    }, { signal });
  };

  /**
   * Zoom toward (cursorX, cursorY) which are coordinates relative to
   * the canvas element (not the page).
   */
  #zoomAround = (cursorX: number, cursorY: number, factor: number) => {
    // `this.#state.scale * factor` is the naive scale if the zoom factor is
    // applied without any limits. To avoid absurdly large or negative scaling,
    // we clamp to our defined minimum and maximum:
    // Math.max ensures we never go below the defined minimum,
    // Math.min ensures we never go above the defined maximum.
    const newScale = Math.min(
      PanoZoomApp.#ZOOM_MAX,
      Math.max(PanoZoomApp.#ZOOM_MIN, this.#state.scale * factor),
    );
    // The ratio between the new scale and the current scale.
    // If the current scale is 2 and the new scale is 2.5,
    // the ratio is 1.25 — the image got 25% larger. If
    // the current scale is 2 and the new scale is 1.6,
    // the ratio is 0.8 — the image got 20% smaller.
    const ratio = newScale / this.#state.scale;

    // This is the math that enables zooming anchored around the pointer.
    // Before zooming the cursor is at (cursorX, cursorY) in screen-space.
    // After zooming we want what is under the cursor to stay in place.
    // In CSS we reset the transform origin to 0, 0 aka top left.
    // Therefore the result of (cursorX - this.#state.tx) is the horizontal distance
    // from the left edge of the image (tx) to the cursor (cursorX). Similarly, the
    // result of (cursorY - this.#state.ty) is the vertical distance from the top
    // edge of the image (ty) to the cursor (cursorY). The ratio is how much 
    // bigger or smaller the image got, i.e., did we zoom in or out?
    // --
    // Next we multiply the horizontal distance from the left edge of the image to
    // the cursor by the ratio. Why? Because this tells us where our cursor will
    // end up after the scale change. If the image got 25% bigger
    // (ratio = 1.25) and the cursor was 300px from the left edge, after
    // scaling that same point is now 300 * 1.25 = 375px from the left edge.
    // The image grew, so that point moved 75px further right. But we do not
    // want this to move.
    // --
    // We therefore subtract this result from the current cursorX to determine
    // where the left edge of the image should be moved to ensure that the
    // same pixels remain below the cursor after the zoom.
    this.#state.tx = cursorX - ratio * (cursorX - this.#state.tx);
    this.#state.ty = cursorY - ratio * (cursorY - this.#state.ty);
    this.#state.scale = newScale;

    this.#applyTransform();
  };

  #handleScrollWheel = (signal: AbortSignal) => {
    if (!this.#canvas) {
      throw new Error("Canvas not found");
    }

    const canvas = this.#canvas;

    canvas.addEventListener(
      "wheel",
      (event: WheelEvent) => {
        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        /*
          The clientX and clientY cursor positions are relative to the viewport.
          The canvas does not start there but is offset by the toolbar.
          The left and top (obtained from getBoundingClientRect)
          on rect gives us the canvas's position within the viewport.
          Subtracting these gives us the cursor position relative to
          the canvas's top-left corner. This is then used 
          by zoomAround.
        */
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;

        // @see https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode
        // 0 = pixel mode (trackpads and most mice),
        // 1 = line mode (some mice report scroll in discrete line increments)
        // 2 = page mode (rare, hardly ever used in practice)
        // For a consistent user experience we normalize the delta across browsers
        // and trackpads. We multiply the number of pixels by 20 as a best guess
        // heuristic for the number of pixels per line.
        const delta = event.deltaMode === 1 ? event.deltaY * 20 : event.deltaY;
        // When you pinch on a trackpad, browsers synthesise a WheelEvent with
        // ctrlKey set to true. the delta values between pinch gestures and
        // a sroll wheel are also very different with a scroll wheel having
        // much coarser deltas. Because trackpads report constant finger
        // movement, these produce small, precise fractional deltas. We
        // therefore need to adjust the sensitivity of the scroll wheel
        // downwards much more aggresively.
        // Note: `1 - delta * factor`: Convert a raw pixel delta into a
        // scale multiplier centered around 1. Scrolling down gives a
        // positive deltaY; 1 - (positive number) returns something
        // less than 1, shrinking the scale. Scrolling up gives a
        // negative deltaY; 1 - (negative number) returns something
        // greater than 1, increasing the scale.
        const factor = event.ctrlKey ? 1 - delta * 0.01 : 1 - delta * PanoZoomApp.#ZOOM_STEP * 0.01;

        this.#zoomAround(cursorX, cursorY, factor);
      },
      { passive: false },
    ), { signal };
  };

  #handlePointerEvents = (signal: AbortSignal) => {
    if (!this.#canvas) {
      console.debug("Canvas not found during pointer event handling");
      return;
    }

    const canvas = this.#canvas;

    let pointerOrigin: { x: number; y: number } | null = null;
    let panStart = { tx: 0, ty: 0 };

    canvas.addEventListener("pointerdown", (event: PointerEvent) => {
      // A value of 0 (zero) on `event.button` indicates that the main (generally
      // the left) button was pressed.
      if (!this.#state.imageLoaded || event.button !== 0) {
        return;
      }

      event.preventDefault();

      // This is the primary reason we are using pointerdown as opposed to
      // mousedown, for example. By capturing the events we are funnelling
      // all events for this pointer into our element. This avoid instances
      // where the pointer can accidentally trigger an action in the
      // toolbar, for example, while panning.
      canvas.setPointerCapture(event.pointerId);
      canvas.dataset.state = "panning";

      pointerOrigin = { x: event.clientX, y: event.clientY };
      panStart = { tx: this.#state.tx, ty: this.#state.ty };
    }, { signal });

    canvas.addEventListener("pointermove", (event: PointerEvent) => {
      if (!pointerOrigin) {
        return;
      }

      const deltaX = event.clientX - pointerOrigin.x;
      const deltaY = event.clientY - pointerOrigin.y;

      this.#state.tx = panStart.tx + deltaX;
      this.#state.ty = panStart.ty + deltaY;

      this.#applyTransform();
    }, { signal });

    const stopPan = () => {
      if (!pointerOrigin) {
        return;
      }

      pointerOrigin = null;
      canvas.setAttribute("data-state", this.#state.imageLoaded ? "grab" : "default");
    }

    canvas.addEventListener("pointerup", stopPan, { signal });
    canvas.addEventListener("pointercancel", stopPan, { signal });
  }

  #handleFileInput = (signal: AbortSignal) => {
    const fileInput: HTMLInputElement | null = this.querySelector("#file-input");
    const openButton: HTMLButtonElement | null = this.querySelector("#btn-open");

    if (!fileInput || !openButton) {
      return;
    }

    openButton.addEventListener("click", () => {
      fileInput.click();
    }, { signal });

    fileInput.addEventListener("change", () => {
      if (!fileInput.files || fileInput.files.length === 0) {
        return;
      }

      this.#loadFile(fileInput.files[0]);
      fileInput.value = ""; // allow re-opening same file
    }, { signal });
  }

  #resetZoom = () => {
    if (!this.#state.imageLoaded || !this.#canvas) {
      return;
    }

    const canvasWidth = this.#canvas.clientWidth;
    const canvasHeight = this.#canvas.clientHeight;

    this.#state.scale = 1;

    this.#state.tx = (canvasWidth - this.#state.imgW) / 2;
    this.#state.ty = (canvasHeight - this.#state.imgH) / 2;

    if (this.#stage) {
      const stage = this.#stage;

      stage.style.transition = "transform 0.2s ease";
      stage.addEventListener("transitionend", () => {
        stage.style.transition = "";
      }, { once: true });
    }

    this.#applyTransform();
  }

  #zoomIn = () => {
    if (!this.#canvas) {
      return;
    }

    const canvasX = this.#canvas.clientWidth / 2;
    const canvasY = this.#canvas.clientHeight / 2;
    this.#zoomAround(canvasX, canvasY, PanoZoomApp.#ZOOM_BTN_FAC);
  }

  #zoomOut = () => {
    if (!this.#canvas) {
      return;
    }

    const canvasX = this.#canvas.clientWidth / 2;
    const canvasY = this.#canvas.clientHeight / 2;
    this.#zoomAround(canvasX, canvasY, 1 / PanoZoomApp.#ZOOM_BTN_FAC);
  }

  #handleToolbarEvents = (signal: AbortSignal) => {
    const fitToCanvasButton: HTMLButtonElement | null = this.querySelector("#btn-fit");
    const zoomInButton: HTMLButtonElement | null = this.querySelector("#btn-zoom-in");
    const zoomOutButton: HTMLButtonElement | null = this.querySelector("#btn-zoom-out");
    const resetZoomButton: HTMLButtonElement | null = this.querySelector("#btn-1x");

    if (!fitToCanvasButton || !zoomInButton || !zoomOutButton || !resetZoomButton) {
      return;
    }

    fitToCanvasButton.addEventListener("click", () => {
      this.#fitToViewport(true);
    }, { signal });

    const toolbar = this.querySelector(".toolbar");

    if (!toolbar) {
      return;
    }

    toolbar.addEventListener("click", (event: Event) => {
      const target = event.target as HTMLElement;

      if (target.matches(`#${zoomInButton.id}`)) {
        this.#zoomIn();
      }

      if (target.matches(`#${zoomOutButton.id}`)) {
        this.#zoomOut();
      }

      if (target.matches(`#${resetZoomButton.id}`)) {
        this.#resetZoom();
      }
    }, { signal });
  }

  #handleKeyboardEvents = (signal: AbortSignal) => {
    window.addEventListener("keydown", (event: KeyboardEvent) => {
      if (!event.key) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "f":
          this.#fitToViewport(true);
          break;
        case "1":
          this.#resetZoom();
          break;
        case "+":
        case "=":
          this.#zoomIn();
          break;
        case "-":
          this.#zoomOut();
          break;
        default:
          return;
      }
    }, { signal });
  }

  #addEventListeners = () => {
    this.#abortController = new AbortController();
    const  {signal} = this.#abortController;

    this.#handleCanvasEvents(signal);
    this.#handleScrollWheel(signal);
    this.#handlePointerEvents(signal);
    this.#handleFileInput(signal);
    this.#handleToolbarEvents(signal);
    this.#handleKeyboardEvents(signal);
  };
}

if (!customElements.get("panozoom-app")) {
  customElements.define("panozoom-app", PanoZoomApp);
}
