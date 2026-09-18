# Kanbaam QA Review — Round 2 (Independent Verification)

**Verdict: PASS**

Date: 2026-09-18
Scope: Independent re-verification that both blocking defects from Round 1 are fixed, with no regression. Verification performed against `file:///C:/Users/Aam/Documents/GitHub/Kanbaam/index.html`. No app source or tests were modified; scratch harnesses live outside the repo at `C:/Users/Aam/qa-scratch/`.

---

## Defect 1 — Mobile add-project control hidden once a project exists

**Status: FIXED (verified).**

Fix present in `styles.css` `@media(max-width:650px)`: `.rail-new` is now shown as a full-width accent row (`grid-column:1/-1;grid-row:3;min-height:44px;color:var(--accent)`) — no longer `display:none`. Only `.workspace-label,.rail-heading,.quiet-note` are hidden.

Independent reproduction (`qa-scratch/verify.cjs`, real Chromium via Playwright): created a first project, then at each width inspected the `#new-project` control and used it to create a second project.

| Viewport | `#new-project` visible | Height | Clickable (bounding box) | Projects before→after click | Document horizontal overflow |
|----------|------------------------|--------|--------------------------|-----------------------------|------------------------------|
| 390 px   | true  | 44 px | true | 1 → 2 | none (`scrollWidth <= clientWidth`) |
| 320 px   | true  | 44 px | true | 1 → 2 | none |

The control is visible, meets the 44 px minimum touch target, is clickable, and actually creates a second project at both widths, with no document-level horizontal overflow.

## Defect 2 — Stale linked-file write could commit after disconnect

**Status: FIXED (verified).**

Fix present in `storage.js` `enqueue`: after `createWritable()` resolves, the writer rechecks `token!==generation` and, if stale, calls `await stream.abort()` and returns — before any `write`, and again before `close`. `disconnect()` increments `generation`.

Independent reproduction of the predecessor's exact scenario (`qa-scratch/verify.cjs`): mocked a File System Access handle whose `createWritable` resolves only after `disconnect()` is called.
- Sequence: `connect(handle)` → `enqueue()` (awaits `createWritable`) → wait → `disconnect()` → resolve the gated `createWritable` → await the enqueue promise.
- Observed stream operation log: `["createWritable", "abort"]`
- `write` was never called (neverWrote: true)
- `close` was never called (neverClosed: true)
- Stream was aborted (aborted: true)
- `writer.linked` reads `false` (disconnected: true)
- `writer.error` is `null` (clean abort, no spurious error surfaced)

The stale stream is aborted and never writes or closes; linked state reads disconnected.

---

## Automated suites

Exact commands run in `C:/Users/Aam/Documents/GitHub/Kanbaam`:

- `npm test` (`node --test tests/*.test.cjs`) → **9 passed, 0 failed**. Includes the new regression test `a stale write blocked mid-flight after disconnect is aborted, never committed`.
- `npx playwright test` → **8 passed, 0 failed** (clean run). Includes the new regression test `mobile keeps a working add-project control after the first project exists`.
  - Note: on one earlier full run, `real JSON download round trip, confirmation and invalid import protection` failed once at a `Kanbaam.getState().projects.length===1` poll. It passed in isolation (`-g "real JSON download round trip"`) and passed on a clean full re-run (8/8). Assessed as test-timing flakiness unrelated to either fixed defect; not a product defect observed.

## Accessibility — axe WCAG2A/AA, light mode, populated board

Independent scan (`qa-scratch/axe.cjs`, `@axe-core/playwright`, tags `wcag2a`,`wcag2aa`): light mode forced (`data-theme=light`), two projects created and one task added (populated board previously failing on rail text contrast).

- **violationCount: 0** — zero violations.

Contrast fix confirmed in `styles.css`: light-mode `--muted` is `#63625a` (darkened from the reported `#706f66`).

---

## Non-blocking notes
- The Playwright download round-trip test showed one-off flakiness (see above). Recommend the maintainer stabilize its `expect.poll` timing; it does not affect the shipped fixes.

## Not certified (out of scope / untestable here)
- Native OS file-picker behavior (real `showSaveFilePicker`/`showOpenFilePicker` dialogs and OS permission prompts) — not scriptable; not re-litigated per instructions. Defect 2 was verified against a mocked handle only, which is the testable boundary.
- Real cross-device / real-file persistence beyond the mocked File System Access handle.
- Only the three checks above plus the two named regression tests were exercised for this report; other product behaviors were covered only insofar as the existing `npm test` / `npx playwright test` suites cover them.
