# Kanbaam

A local-first kanban board. Open `index.html` in a modern browser; no build,
account, server, or network connection is needed at runtime.

## Start

1. Download or clone the complete repository, keeping its files together.
2. Open `index.html`. Create a project or try the sample board.
3. Your workspace saves automatically in this browser.
4. Use **Settings > Data > Export JSON** for a portable backup.

The app does **not** create a file beside the HTML automatically. Browser data is
specific to the browser profile and origin/file location; moving the app, clearing
site data, or using private browsing can make that data unavailable. Export backups
regularly.

## Features

- Projects with icons and descriptions; edit, archive, or delete from their menu.
  Restore archived projects in **Settings > Data**.
- Project-specific categories with editable names, colors, order, and completion
  behavior. Backlog, In progress, Review, and Done are the defaults.
- Tasks with priority, tags, due dates, links, descriptions, and optional card colors.
- Search, priority and tag filters, and per-category priority/date sorting.
- Pointer drag-and-drop, touch long-press dragging, and keyboard reorder controls.
- Light/dark/system appearance, preset or custom accents, a brief session splash,
  and reduced-motion support.
- Device-local background images with dim and blur controls. Images are not
  included in workspace exports.
- Validated JSON import/export, with a backup of browser data before replacement.
- Optional linked JSON files in browsers supporting the File System Access API.
  File access requires permission and must be reconnected after reopening.

## Development

Requires Node.js and npm. Runtime scripts and Lucide icons are bundled locally.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:browser
```

Rebuild the bundled icon subset after editing `scripts/build-icons.cjs`:

```sh
npm run build:icons
```

Browser tests cover Chromium, responsive layouts, and automated accessibility
checks. Real OS file pickers and physical touch devices still need manual testing.

## Source Layout

- `index.html`, `styles.css`: interface, dialogs, and themes.
- `app.js`: interactions, rendering, and animation.
- `model.js`: validation and project/task/category operations.
- `storage.js`: browser persistence and optional linked-file writes.
- `background.js`: device-local image storage and processing.
- `assets/`: bundled icons and their upstream license.
- `tests/`: unit and browser regression coverage.

## Third-Party License

Bundled Lucide icons retain their license in `assets/lucide-LICENSE`.
