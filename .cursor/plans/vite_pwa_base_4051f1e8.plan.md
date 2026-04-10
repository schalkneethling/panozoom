---
name: Vite PWA base
overview: "Add `@vite-pwa/vite-plugin` for service worker registration and precaching, keep the existing static [`public/site.webmanifest`](public/site.webmanifest) by setting `manifest: false`, and extend that JSON so install criteria (start_url, scope, icon purposes) are satisfied."
todos:
  - id: add-dep
    content: Add @vite-pwa/vite-plugin devDependency; run vp install
    status: completed
  - id: vite-pwa-config
    content: Register VitePWA with manifest false, workbox, injectRegister auto
    status: completed
  - id: static-manifest
    content: Extend public/site.webmanifest (start_url, scope, description, purpose all icons)
    status: completed
  - id: verify-build
    content: vp build + vp preview; confirm SW + manifest in DevTools
    status: completed
isProject: false
---

# Minimal installable PWA with vite-plugin-pwa

## Context

- Build entry is [`vite.config.ts`](vite.config.ts) using `defineConfig` from `vite-plus` (Vite-compatible); plugins are added via the standard `plugins` array.
- App entry is [`index.html`](index.html) → [`src/panozoom.ts`](src/panozoom.ts) (plus [`src/style.css`](src/style.css)).
- You already have [`public/site.webmanifest`](public/site.webmanifest), maskable PNGs (`web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`), and `<link rel="manifest" href="/site.webmanifest" />` in [`index.html`](index.html).

**Installability** needs a **registered service worker** (plugin) plus a manifest that includes **`start_url`**, **`scope`**, and **at least one icon with `purpose: 'all'`** alongside maskable icons. Those manifest fields are missing or incomplete today; they are added by **editing the static JSON**, not by the plugin.

## Why keep the static manifest (`manifest: false`)

There is **no strong reason** to delete [`public/site.webmanifest`](public/site.webmanifest) if you prefer to own the file. Set **`manifest: false`** in the plugin so it **does not** emit a second manifest into `dist` (see [vite-plugin-pwa discussion on ignoring manifest creation](https://github.com/vite-pwa/vite-plugin-pwa/issues/275)).

**Tradeoff:** you maintain install metadata in JSON instead of TypeScript. The plugin will **not** inject `<link rel="manifest">` or `theme-color` from config—your existing manifest link in [`index.html`](index.html) stays; add a `<meta name="theme-color" content="...">` yourself if you want it to match `theme_color` (optional quick win).

## Dependency and install

- Add **`@vite-pwa/vite-plugin`** as a `devDependency` in [`package.json`](package.json) (pinned version consistent with your Vite major—resolve at install time if needed).
- Run **`vp install`** after editing `package.json` per [`AGENTS.md`](AGENTS.md).

## Vite configuration

In [`vite.config.ts`](vite.config.ts):

1. Import and register **`VitePWA`** from `@vite-pwa/vite-plugin`.
2. **Minimal, install-focused** setup:
   - **`manifest: false`** — no generated manifest; reuse [`public/site.webmanifest`](public/site.webmanifest) (copied to `dist` as today).
   - **`registerType: 'autoUpdate'`** — new SW activates on refresh.
   - **`injectRegister: 'auto'`** — injects registration into built HTML (no `virtual:pwa-register` import in [`src/panozoom.ts`](src/panozoom.ts)).
   - Omit **`manifestFilename`** (not used when manifest generation is off).
   - **`workbox.globPatterns`**: e.g. `**/*.{js,css,html,ico,png,svg,webmanifest}` so the shell can load offline after one visit.
   - **`includeAssets`** (optional): e.g. `favicon.ico`, `apple-touch-icon.png`, `favicon.svg`, `favicon-96x96.png`, `panozoom-social-share.png` for clearer precache coverage of `public/` assets.

No `injectManifest` / custom SW file for this baseline; default **GenerateSW** is enough.

## Static manifest updates

Edit [`public/site.webmanifest`](public/site.webmanifest) (single source of truth):

- Add **`start_url`**: `"/"` and **`scope`**: `"/"` (adjust if the app is ever deployed under a subpath and Vite `base` is set).
- Add optional **`description`** aligned with [`index.html`](index.html).
- **`icons`**: keep existing **maskable** 192/512 entries; **add** at least one entry (reuse the same `src` files) with **`purpose: "all"`** so install prompts are not maskable-only.

Do **not** remove the manifest `<link>` from [`index.html`](index.html).

## Verification

- **`vp build`** then **`vp preview`**: DevTools → Application → confirm **Service worker** and that the **Manifest** panel reads your static `site.webmanifest` (with new fields). Test install / Add to Home Screen where supported.
- **Note:** SW often off in `vp dev` unless you enable **`devOptions.enabled: true`** (optional).

## Optional follow-ups

- **`vite-plugin-pwa/client`** in [`tsconfig.json`](tsconfig.json) only if you switch to an explicit `virtual:pwa-register` import.
- **`screenshots`** / **`categories`** in the static manifest for richer install UI.
