# Browser tests for modules/components

Detail layer for the [`.dev/roadmap.md`](../../../roadmap.md) entry "Storybook (or similar) for `modules/components`/`modules/charts`, carrying their own integration tests", on its integration-test half. It records what a first run in real browsers showed, and what bringing such tests into the repo involves.

---

## Why browser tests

`modules/components` is tested with Jest under Node. Some of its behaviour exists only in a browser engine and differs between engines, such as how a hidden frame loads, how a form submission inside it navigates, and when a response becomes a download. Jest cannot observe any of it. `utils/download.js` is the case that prompted this: a portal reported that its download button sent nothing, and the helper's shape suggested an engine-dependent race.

## A first run, outside the repo (2026-10-30)

Playwright 1.64.1 was installed with `--no-save` in a scratch folder, its browsers in Playwright's own cache, so the repo was untouched.

**The harness.**
- esbuild bundled the real `modules/components/src/utils/download.js` into one IIFE exposing it on `window`. esbuild has no flag for extra module paths, so the repo's `node_modules` was given through `NODE_PATH`.
- A Node `http` server on loopback served a page holding the bundle, and counted each `POST` to a stub download route, answering with an attachment.
- Each engine opened the page five times, called the helper, and waited 1.5 s. The server counted the submissions that arrived, and Playwright counted the downloads that started.
- A second variant submitted the same form only after the frame's `load` event, as a candidate fix.

**What it showed.**

| Engine | Current helper | Submitting on the frame's load |
| --- | --- | --- |
| Chromium 156 (Chrome for Testing) | 5 of 5 arrived and started a download | 5 of 5 |
| WebKit 27.2 | 5 of 5 | 5 of 5 |
| Firefox 157 | Not run: in the sandboxed shell it was launched from, Firefox could not create its profile folder | Not run |

So the race the helper's shape suggests did not occur in Chromium or WebKit, headless, in isolation. Real Safari, on a portal, did drop it: each click created the frame and no request followed, with nothing in the console, while the same form posted from the page reached the server. Playwright's WebKit build is not Safari, so a pass there does not clear an engine-dependent fault, and such a fault is pinned by a unit test of the structure plus a check by hand in the real browsers.

**Practical notes.**
- The browsers take about 370 MB for Chromium, 200 MB for its headless shell, 295 MB for Firefox and 300 MB for WebKit, in Playwright's cache rather than the repo.
- Firefox needs a writable temporary profile folder, which a sandboxed shell may refuse.

## What `utils/download.js` does, for whoever touches it

- It submits from a form in the page, targeting a hidden frame by name, and the frame has no `src`. It used to build the form inside the frame's `about:blank` document and submit it at once, which Safari dropped. Waiting for the frame's `load` was set aside: engines differ in when they fire `load` for an `about:blank` frame, so waiting for it trades one timing dependency for another.
- A form cannot set request headers. `addDownloadHttpHeaders` therefore posts its headers as a form field named `httpHeaders`, which no server reads as headers. A download through the helper carries a credential only when it posts to its own origin and a proxy there attaches one, as a portal's server-side proxy can.
- Each field is a hidden input whose `value` is set as a property, never written as markup, so the export route receives each value exactly as the caller passed it, with no escaping to get right.
- The response goes to the frame and becomes a file, so no page script reads its headers, `Arranger-Export-Truncated` included.
- Fetching the export and saving the result would read those headers and could send a bearer token, but it holds the whole export in memory, where the form streams it to disk.

## Bringing browser tests into the repo

| Piece | What it involves |
| --- | --- |
| Dependency | `@playwright/test` as a dev dependency of `modules/components`, so nothing published changes |
| Harness for plain modules | An esbuild bundle and a stub server, as in the run above |
| Harness for React components | Playwright's component testing runs on Vite, so it needs a Vite configuration matching the package's Babel setup (the Emotion plugin and the module aliases), and it is still experimental |
| Placement | Beside their source, per the test co-location convention, under a name Jest does not collect |
| Local runs | `npx playwright install` once per machine |
| CI | Jenkins runs tests on a plain Node image, which lacks the system libraries browsers need. Either install them each run (`playwright install --with-deps`, a minute or two per engine) or add Playwright's own image as a container in the pod. Both are changes to the pipeline library |
| Engines | All three locally. Chromium alone in CI keeps the stage short, with Firefox and WebKit added once their cost is known |

A first unit could carry the harness and the download helper's tests across the three engines, with React component tests following under the roadmap item.

## Test ideas

- The download helper's submission arrives in every engine, Firefox and real Safari included.
- Every field value arrives at a real server exactly as the caller passed it, beyond the unit test's check of each input's value.
