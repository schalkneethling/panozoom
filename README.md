# Panozoom

A small browser app for opening an image and exploring it with **pan** and **zoom**. Everything runs locally in the page: no upload to a server.

**Live site:** [panozoom.schalkneethling.com](https://panozoom.schalkneethling.com)

**Progressive Web App:** Panozoom is installable from supported browsers (install / “Add to Home Screen”) and runs in a standalone window. A service worker precaches the app shell so it can open offline after you have loaded it once while online.

## What it does

- **Open images** via the toolbar, a file picker, or drag-and-drop onto the canvas.
- **Pan** by clicking and dragging on the image (pointer capture keeps movement predictable).
- **Zoom** with the scroll wheel; zoom is anchored to the pointer so the point under the cursor stays put. Trackpad pinch gestures are supported.
- **Toolbar controls** for fit-to-view, 1:1 (actual pixels), and stepped zoom in/out.
- **Keyboard shortcuts:** `F` fit, `1` 100%, `+` / `=` zoom in, `-` zoom out.

Zoom range is clamped between roughly 2% and 6400% so navigation stays usable.

## Tech stack

- [TypeScript](https://www.typescriptlang.org/)
- [Vite+](https://viteplus.dev/) (Vite-based tooling: dev server, build, lint, test)
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa) for the service worker and precaching (manifest lives in `public/site.webmanifest`)
- A single [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) (`<panozoom-app>`) that owns interaction logic; styles live in `src/style.css`.

## Development

This repo expects the **`vp`** (Vite+) CLI. Install dependencies and run checks with Vite+ rather than calling the package manager or raw Vite for project workflows.

```bash
vp install
vp dev
```

Other useful commands:

```bash
vp build    # production build
vp preview  # preview production build
vp check    # format + lint (use --fix to auto-fix where possible)
vp test     # tests
```

`package.json` scripts (`dev`, `build`, `preview`) wrap these for convenience.

See [`AGENTS.md`](./AGENTS.md) for Vite+ conventions (e.g. `vp test` / `vp lint` instead of separate tool binaries).

## Project layout

| Path              | Role                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `index.html`      | App shell, favicons, PWA manifest link, social meta tags              |
| `src/panozoom.ts` | `PanoZoomApp` custom element and behavior                             |
| `src/style.css`   | Layout and UI                                                         |
| `public/`         | Static assets served at the site root (icons, manifest, social image) |
