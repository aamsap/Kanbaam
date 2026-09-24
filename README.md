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
  behavior. Backlog, In progress, Review, and Done are the defaults; templates
  can extend or replace a project's categories.
- Tasks with priority, tags, due dates, links, descriptions, and optional card colors.
- Search, priority and tag filters, and per-category priority/date sorting.
- Pointer drag-and-drop, touch long-press dragging, and keyboard reorder controls.
- Light/dark/system appearance, English/Indonesian interface, preset or custom
  accents, a brief session splash, and reduced-motion support.
- Background images with dim and blur controls. Mode/dim/blur travel with the
  workspace; the image itself stays device-local and is not included in exports.
- Validated JSON import/export, with a backup of browser data before replacement.
- Optional linked JSON files in browsers supporting the File System Access API.
  Kanbaam remembers the link and reconnects only after checking that its data
  matches the browser workspace. When permission is needed, use Reconnect.

## Conflicts and recovery

Keep one editor open for a linked file. If another browser tab changes the board,
Kanbaam pauses saving in the stale tab rather than replacing the newer browser
copy. Export JSON from the paused tab to preserve its unsaved edits, then reload
and reconcile them manually with the newer board.

If the linked file differs from the browser board on reconnect or changes outside
Kanbaam, automatic file writes stop. Export the browser board before resolving the
conflict. Use **Open & link file** to load the file into the browser (confirmation
backs up the prior browser payload), or **Create linked file** to write the browser
board to a separate file. Do not overwrite an existing file until you have checked
both copies. If browser storage is corrupt or saving fails, export your in-memory
board before closing; linked-file writing is disabled until browser storage is
recovered.

## Development

Requires Node.js and npm. Runtime scripts and Lucide icons are bundled locally.

```sh
npm ci
npx playwright install chromium
npm run verify
```

`npm run verify` runs syntax checks, unit tests, and browser tests in sequence.

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
