# Kanbaam

A small, local-first kanban board. No account, server, build step, or runtime dependencies.

## Start

Download or clone this folder, then double-click **index.html**. Keep the HTML, CSS, and JavaScript files together. An internet connection is not required.

Node.js and npm are **only for contributors running tests**. They are not needed to use the app.

## A note about JSON storage

A browser cannot silently create a JSON file beside an HTML document. That restriction protects your filesystem; opening a downloaded page does not grant it permission to write arbitrary files.

Kanbaam uses two storage options:

- **Browser storage:** initialized automatically on first launch, with the workspace serialized as JSON in `localStorage`. This is browser-managed storage, not a visible file in the repository.
- **A JSON file you choose:** supported browsers can ask permission to create or open a local JSON file and save changes to it during the session. Reconnect the file when reopening the app. If your browser does not support file linking, use JSON export and import instead.

Browser storage belongs to the browser profile and page location. In `file://` mode its behavior is browser-dependent. Moving the folder, switching browsers, private browsing, or clearing site data can make previously stored work unavailable. **Export regular JSON backups**, especially before moving the folder. A linked file is not a multi-user database: avoid editing the same file from multiple tabs or apps simultaneously.

Your task content stays on your device. Do not commit personal JSON exports to a public repository.

## Development

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:browser
```

Browser tests open the actual `index.html` using `file://`; they do not substitute a development server for the advertised startup path.

## Architecture

- `index.html`: document and native forms/dialogs
- `styles.css`: responsive layout, theme tokens, motion, and reduced-motion treatment
- `model.js`: workspace data and validation
- `storage.js`: browser persistence and linked JSON file operations
- `app.js`: application interactions and rendering (cards, tags, drag, dialogs)
- `tests/`: data/storage regression tests and real-browser checks

No backend, analytics, remote fonts, or CDN scripts are required.
