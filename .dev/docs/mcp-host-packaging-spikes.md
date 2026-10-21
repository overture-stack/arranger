# MCP host packaging spikes: Ink bundling, the Tauri sidecar and Electron's hardened runtime

Three spikes, short throwaway experiments, run on 2026-10-16 and 2026-10-19. Each tested, by building something real, a claim that until then rested on a GitHub issue, a tool's history, an architecture document's own reasoning or an inconclusive earlier attempt, since a real build was cheap enough to run instead. One of them overturned the conclusion the earlier evidence had suggested.

This document is the full record: exact versions, exact commands, exact errors, exact fixes. [`mcp-host-plan.md`](mcp-host/mcp-host-plan.md) carries the resulting decisions in condensed form; this is where to check them, reproduce them, or find the gap if a later Tauri or Node release changes the facts underneath them.

Terms used below:

| Term                 | Meaning here                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TUI                  | A text user interface: an app that draws its interface in a terminal.                                                                                  |
| Ink                  | A library for building terminal interfaces with React.                                                                                                 |
| Yoga                 | The layout engine Ink uses to position text in the terminal.                                                                                           |
| WASM                 | WebAssembly: compiled code that runs inside a JavaScript engine.                                                                                       |
| Bun                  | A JavaScript runtime, an alternative to Node, which can also compile an app into a single file.                                                        |
| SEA                  | Node's single executable application feature, which packages an app together with Node into one file.                                                  |
| `pkg`                | An older tool for packaging a Node app into one executable.                                                                                            |
| esbuild              | A tool that bundles an app's source files into one file.                                                                                               |
| ESM and CJS          | JavaScript's two module formats: ES modules, and the older CommonJS.                                                                                   |
| ICU                  | The Unicode data a JavaScript engine needs for handling text; a "small-icu" build carries only part of it.                                             |
| pty                  | A pseudo-terminal, which lets a test run a program as though it were in a real terminal.                                                               |
| Sidecar              | In Tauri, a separate helper program shipped inside the app.                                                                                            |
| Entitlements         | The permissions a macOS app declares to the operating system.                                                                                          |
| Provisioning profile | Apple's per-app licence for restricted entitlements.                                                                                                   |
| Hardened runtime     | A macOS security mode that, among other things, blocks generating code at run time unless the app is entitled to.                                      |
| AMFI                 | Apple Mobile File Integrity, the macOS component that checks an app's signature and entitlements at launch.                                            |
| Ad-hoc signing       | Signing an app without an Apple developer certificate, which is enough for testing on one machine only.                                                |
| Helper process       | One of Electron's own separate OS processes besides the main process: GPU, renderer and plugin each get one, plus a base Helper for utility processes. |
| Fuses                | Switches fixed when the app is built, each turning off a feature an attacker could misuse.                                                             |
| `safeStorage`        | Electron's interface to the operating system's secret store, the keychain on macOS, used only in the main process.                                     |

---

## 1. Can `chat`'s TUI library (Ink) be compiled into a standalone, Node-free binary?

### Why this was in question

`chat` (the MCP host's terminal client) was to ship as a standalone executable, not an npm package requiring Node on the end user's machine. Ink, the best ecosystem fit for the UI layer (React for terminal apps, used at real scale by Claude Code and others), depends on a layout engine, Yoga, that historically shipped a separate `yoga.wasm` file. A documented 2024 bug (`oven-sh/bun#13552`) reported `bun build --compile` failing to find that file inside a compiled binary. Whether `pkg` or Node's own `--build-sea` had the same problem was unconfirmed, and nobody had published an answer either way as of this investigation.

### Method

Four real builds, not research: a minimal Ink app (a bordered, coloured `<Box>` around `<Text>`, chosen specifically because flexbox/border layout is what actually invokes Yoga's engine, unlike a bare `<Text>`-only app which could pass trivially without exercising it) compiled three different ways, plus a fourth build of a different, "obviously safe" pure-JS library (`terminal-kit`) with `pkg`, as a control.

Versions in use throughout: `ink` 8.0.0, `react` 19.3.1, `yoga-layout` 3.2.1 (Ink 8's floor), `esbuild` 0.28.2, `@yao-pkg/pkg` 6.23.0. All read from `npm view` at the time of the spike, not assumed.

### Finding 0: the root cause of the original bug is gone

Reading the installed `yoga-layout` 3.2.1 package directly (not inferring from the bug report) showed `dist/binaries/yoga-wasm-base64-esm.js`: the WASM binary inlined as a base64 string directly in a JS module, loaded purely in memory, with no `readFileSync`, no `__dirname`, no on-disk path lookup at all. The entire class of bug the Bun issue described, a compiled binary unable to locate a separate `.wasm` asset, cannot occur against this version, because the separate asset no longer exists. This was independently confirmed by two of the three build paths below, reading the same file for the same reason, before either knew the other had found it.

### `bun build --compile`: pass, cleanly

Bun was not installed at the start of this spike and was installed fresh (`curl -fsSL https://bun.sh/install | bash`, resulting version 1.4.3) specifically to test this path rather than relying on the old issue thread.

One real fix needed: Ink 8's optional peer dependency `react-devtools-core` is not treated as optional by Bun's bundler, which refused to resolve it (`Could not resolve: "react-devtools-core"`) until it was installed as a real dependency (`bun add react-devtools-core@8.0.0`). Unrelated to Yoga or WASM.

Build: `bun build ./index.tsx --compile --outfile dist/ink-bun-spike`. Verification was deliberately paranoid about false positives: the first run under the test harness produced zero visible stdout, which could have read as either "it works but there's no TTY" or "it silently failed." Confirmed it was the former by reproducing the identical empty output from the _uncompiled_ `bun run index.tsx` in the same non-TTY shell, then re-running both under a real pty (`script`). Under the pty, the compiled binary rendered a correct rounded-border box containing "Hello, world!" with the border computed by Yoga, proof the WASM engine actually executed rather than merely having loaded without error.

Binary size: 72,761,330 bytes (~69.4 MiB), embedding the full Bun runtime. In the same range as Claude Code's own reported ~100 MB binary, which uses the identical stack (React, Ink, Yoga, `bun build --compile`) at production scale.

### Node's `--build-sea`: pass, cleanly, and verified genuinely self-contained

Environment: Node v26.10.0, comfortably above the v25.5.0 floor for `--build-sea`.

Getting there needed three fixes, none specific to Node or SEA, all general consequences of Ink 8 being ESM-only with an unconditional top-level `await` in Yoga's loader (`const Yoga = wrapAssembly(await loadYoga())`):

1. **`--format=cjs` is flatly impossible.** `esbuild` refuses outright: "Top-level await is currently not supported with the cjs output format." The build has to stay ESM. SEA supports this natively via `"mainFormat": "module"` in `sea-config.json`, so this is a non-issue for SEA specifically, just a dead end for anyone assuming CJS is the default safe choice.
2. **A static top-level `import {render} from 'ink'` triggers an esbuild-internal bug**, not a Node or Ink bug: when a CJS import (`react`) and a top-level-await-using ESM import coexist statically in one entry file, esbuild's `__commonJS` wrapping produces a `SyntaxError: Unexpected reserved word` on the emitted `await`. Fixed by restructuring the entry point to `async function main() { await import('ink'); ... } main();`, deferring to a dynamic import, which sidesteps the bug entirely.
3. **A handful of Ink's small CJS dependencies (`signal-exit`, `stack-utils`) call `require(...)` in shapes esbuild cannot statically rewrite for ESM output.** Its internal `__require` shim checks `typeof require !== "undefined"`, false in genuine ESM scope, throwing "Dynamic require of ... is not supported" at runtime. Fixed with an esbuild banner injecting a real `require`: `import { createRequire } from 'node:module'; globalThis.require = createRequire(import.meta.url);`.

`react-devtools-core` needed the same treatment as the Bun path (installed as a devDependency so esbuild could bundle the dead-code branch that references it).

Build chain: `esbuild.build({ entryPoints: ['app-dynamic.mjs'], bundle: true, platform: 'node', format: 'esm', outfile: 'app-esm-final.mjs', banner: {...} })`, then a `sea-config.json` of `{ "main": "app-esm-final.mjs", "mainFormat": "module", "output": "ink-sea-demo", "disableExperimentalSEAWarning": true }`, then `node --build-sea sea-config.json`, then `codesign --sign - ink-sea-demo` (required on macOS even for ad-hoc use).

Verification went beyond "it ran once": the resulting 147 MB arm64 Mach-O binary was run from an unrelated directory (`/tmp`), and again with the project's own `node_modules` renamed out of the way, both times rendering the correct green-bordered box with no disk dependency at all. This is the strongest self-containment evidence of the three paths.

### `pkg`: compiles and runs, but is not actually a single-file artifact

Needed the identical ESM/esbuild fixes as the SEA path above (same root cause: Ink 8's ESM-only, top-level-await structure), confirming those three fixes are a property of the Ink/esbuild combination, not of either compiler.

A fourth, `pkg`-specific problem then appeared, unrelated to Yoga entirely: pkg's prebuilt base Node binaries are **small-icu** builds. The compiled binary crashed on the very first `<Text>` render with `RangeError: Intl.Segmenter is unavailable ... embeds a small-icu Node.js build`, because Ink uses `Intl.Segmenter` internally for text layout. pkg's own suggested remedy, its `--sea` output mode (full-icu Node), fails differently: Node's SEA mode cannot run an ESM entry at all ("Cannot use import statement outside a module"), so that door is closed too for an ESM-only app like this one.

The actual working fix: manually source a full ICU data file (`icudt78l.dat`, matching the pkg-embedded Node's ICU major version, fetched from `unicode-org/icu`'s GitHub releases, ~33 MB) and set `NODE_ICU_DATA` to point at it as an environment variable at launch. npm's own `full-icu` package could not help, since its postinstall logic only activates when the _host_ Node running the installer is itself small-icu, which is not the situation here (pkg's _embedded_ binary is small-icu; the host Node used to build it is a normal full-icu install).

With `NODE_ICU_DATA` set, the binary rendered the box correctly. But the deployable artifact is now: a binary, plus a required separate ~33 MB data file, plus a required environment variable at launch. That is meaningfully more than "download and run directly," and the gap between "pkg technically produces a working binary" and "pkg produces a self-contained artifact" is the headline finding of this path.

### Control: `terminal-kit` + `pkg` fails, for a reason that generalizes past this spike

`terminal-kit` was chosen as a control specifically because it is pure JavaScript, with no native bindings and no WASM asset, the exact property assumed (before this spike) to guarantee clean bundling. It still failed:

```
Error: Cannot find module './termconfig/xterm.generic.js'
```

`terminal-kit` resolves its terminal-capability file with a **dynamic** `require()` keyed on the detected `$TERM` value. `pkg` bundles a snapshot filesystem based on **static analysis** of `require()` calls, and a computed path is invisible to that analysis, so the file is silently left out. Adding the directory as a `pkg.assets` glob in `package.json` does not fix this: `assets` restores file _access_ inside the snapshot, it does not restore a dynamic `require()` call's ability to _resolve_ a path it never saw at build time. pkg's own error message names the real fix correctly (rewrite the dynamic `require()` to use an absolute, `process.execPath`-relative path), which is not something a project can do to a third-party dependency's own source without patching it.

**The generalization**: "pure JavaScript, no native bindings" does not imply "bundles cleanly under a static-analysis compiler like `pkg`." Dynamic `require()` is its own, independent failure class, orthogonal to the native-addon and WASM-asset concerns this spike originally set out to test. Any library under consideration for standalone-binary packaging needs the same empirical check this spike ran, not an inference from its dependency tree.

### Outcome

| Path                             | Verdict                        | Artifact                                             | Size     | Fixes needed                                  |
| -------------------------------- | ------------------------------ | ---------------------------------------------------- | -------- | --------------------------------------------- |
| `bun build --compile`            | Pass                           | Single file                                          | ~72.8 MB | 1 (peer dependency)                           |
| Node `--build-sea`               | Pass, verified dependency-free | Single file                                          | ~147 MB  | 3 (ESM/esbuild quirks, none SEA-specific)     |
| `pkg`                            | Runs, not single-file          | Binary + required ~33 MB ICU file + required env var | n/a      | Same 3, plus a pkg-specific ICU workaround    |
| `terminal-kit` + `pkg` (control) | **Fail**                       | n/a                                                  | n/a      | Unrelated: dynamic `require()` pkg cannot see |

Ink is cleared for use. The choice between Bun and Node's `--build-sea`, both genuinely single-file, is decided in `mcp-host-plan.md` Phase 5, for Bun's `--compile`.

---

## 2. Does Tauri's sidecar mechanism survive real macOS entitlements?

### Why this was in question

`mcp-host-plan.md` already decided against Tauri partly on the strength of `tauri-apps/tauri#16211`: a report that Tauri signs every sidecar (`externalBin`) with the main app's own entitlements file, with no way to narrow them, killing the sidecar at launch on some configurations while `codesign --verify` and notarization both report success. A GitHub issue's open or closed status does not reliably indicate whether a bug is actually fixed, so this report's status needed the same empirical treatment as the Yoga/WASM bug above, rather than being taken at face value in either direction.

### Setup

The machine's installed Rust (1.67.1) was roughly three years behind current Tauri's requirement. Current Tauri (2.12.x) needs Rust 1.90 as its minimum supported version (confirmed against Tauri's own 2.12 release notes and the `tauri` crate's `crates.io` listing, which raised the floor by dropping official Windows 7 support). `rustup update stable` resolved this (rustc/cargo 1.99.1).

A Tauri v2 app was scaffolded fresh (`npm create tauri-app@latest`, vanilla template; `@tauri-apps/cli` 2.12.3, `tauri` crate 2.12.4, `tauri-plugin-shell` 2.5.0, all current as of this spike). Rather than a toy "echo" sidecar, the already-built, already-verified Node `--build-sea` binary from the Ink spike above was reused as the actual sidecar, copied to `src-tauri/binaries/` under Tauri's required target-triple naming convention and registered via `bundle.externalBin` in `tauri.conf.json` plus a `shell:allow-execute` capability scoped to it. Rust code in `.setup()` spawns it via `app.shell().sidecar(...)` and logs every `CommandEvent` (stdout, stderr, error, termination with code and signal) to a file, so results are checkable by process-level evidence rather than by watching a window.

No real Apple Developer certificate or notarization credentials were available on the machine the spike ran on; every signed build below used ad-hoc signing (`signingIdentity: "-"`).

### The sidecar mechanism itself: works correctly under normal conditions

Confirmed across three configurations, each producing byte-identical output to the standalone binary (a rendered bordered box, not just a zero exit code):

- `tauri dev` (unsigned).
- The built, `open`-launched `.app` with the template's default configuration (no entitlements at all).
- The built `.app`, ad-hoc signed, with a harmless entitlements plist that correctly includes `com.apple.security.cs.allow-jit` (see below for why that key specifically is load-bearing).

A separate Electron test, run to check whether Electron itself could be spiked the same way, never launched a process at all: the `electron` binary resolved and executed but reported a plain Node version rather than initializing, with no window and no process visible afterward. §3 traces this to an inherited `ELECTRON_RUN_AS_NODE` and tests Electron against the same checks. This does not bear on the Tauri verdicts below, which rest entirely on process-level evidence (exit codes, signals, `codesign` output, kernel logs) from a Tauri app that did build and run.

### The entitlements bug: reproduced, with the exact kernel-level mechanism confirmed

Built with `bundle.macOS.entitlements` pointing at a plist containing the issue's exact trigger combination: `com.apple.security.device.audio-input` (harmless) alongside `com.apple.developer.associated-domains` (restricted, requires a provisioning profile this ad-hoc build does not have), ad-hoc signed, via `tauri build --bundles app`.

- `codesign -d --entitlements -` on the embedded sidecar showed entitlements **byte-identical** to the main binary's, including the restricted one the sidecar has no business holding. This directly confirms the report's central technical claim: Tauri's bundler signs every sidecar with the whole app entitlements file, with no per-sidecar option.
- Direct execution of the sidecar from inside the built bundle: **exit code 137** (128 + 9, SIGKILL). Zero stdout bytes; it never got far enough to render anything.
- `log show` pulled the exact moment of the kill:
    ```
    amfid: (AppleMobileFileIntegrity) Restricted entitlements not validated, bailing out.
      Error Domain=AppleMobileFileIntegrityError Code=-427 "Unable to retrieve certificate chain"
    amfid: (AppleMobileFileIntegrity) Adhoc signed app with restricted entitlements detected
    amfid: .../Contents/MacOS/ink-sea-demo not valid:
      Error Domain=AppleMobileFileIntegrityError Code=-424 "The file is adhoc signed but contains restricted entitlements"
    ```
    This names the sidecar by its full path, and the `-427` code matches the original report's own prediction for the ad-hoc-signing case (as distinct from `-413`, "No matching profile found," predicted for a real notarized build, which this environment could not test).
- `codesign --verify --deep --strict` and the build itself reported success throughout. Nothing in the ordinary toolchain surfaces this failure; it is invisible to CI by construction.

**A nuance the original report predicted and this spike confirmed rather than merely assumed**: under ad-hoc signing with no certificate chain at all, the kill is not selective to the sidecar. Running the _main app binary_ directly with the same restricted entitlements also exits 137, and launching the `.app` via `open` fails outright ("Launchd job spawn failed"). Only with a real Developer ID certificate _and_ a matching provisioning profile would the main executable legitimately satisfy the restricted entitlement while the sidecar, holding no profile of its own, is killed silently, which is the more dangerous, genuinely CI-invisible shape of the bug. That specific asymmetric case could not be directly tested without real signing credentials. What was directly confirmed, identical-entitlements inheritance with no scoping option, is the exact mechanism that produces it once real credentials are in play.

### Control: a clean causal isolation

Rebuilding with entitlements containing only harmless keys, and _no_ restricted one, was run twice. The first attempt (a harmless key alone, without `allow-jit`) produced a _different_ crash entirely: exit 133 (SIGTRAP), V8 aborting with "Fatal process out of memory: Failed to reserve virtual memory for CodeRange". This happens because applying _any_ entitlements plist activates the hardened runtime, and Node's JIT needs `com.apple.security.cs.allow-jit` to allocate executable memory once that runtime is active. Correcting the control to include that key (a genuine requirement, not an artificial fix) produced a clean pass: exit 0, correct rendered output, confirmed byte-for-byte.

This isolates the variable precisely: an entitlements profile correctly provisioned for what the sidecar actually needs works fine; adding one restricted entitlement the sidecar has no profile for is the only change that kills it.

### A finding specific to this project's actual architecture

Because the sidecar tested here is a real Node/V8 standalone binary, exactly the shape this project would ship, it has a hard, load-bearing dependency on `com.apple.security.cs.allow-jit` the moment hardened runtime is active at all. Today, that dependency is satisfied only as a side effect of the sidecar inheriting the _entire_ main app entitlements file. The same architectural gap that causes the restricted-entitlement crash, no way to give a sidecar an entitlements profile different from the main app's, is also the only reason JIT currently works for a Node sidecar at all. A future fix narrowing what a sidecar inherits would need to preserve `allow-jit` specifically for any Node-based sidecar, not just close the security gap; the two problems do not have independent solutions.

### On the originating report's credibility

Checked directly via the GitHub API rather than trusted at face value, in either direction: `tauri-apps/tauri#16211` and its proposed fix, draft PR `#16212`, were filed by the same account (`author_association: NONE`) two minutes apart, zero comments on either, and both closed within about an hour of being opened, the PR never merged. No maintainer engagement is visible anywhere on either. This does not make the technical claim false, and the reproduction above confirms it is not false, but it means the report carried no institutional weight of its own: there was no Tauri acknowledgment, roadmap commitment, or reasoned rejection to lean on, which is exactly why direct reproduction rather than reading the thread was the only way to actually know.

### Outcome

Tauri is ruled out by reproduction, not by the original report's uncertain weight. The failure is real, current (Tauri 2.12.4, Rust 1.99.1), CI-invisible, and structurally worse for this project specifically than for a generic Tauri app, because this project's sidecar is Node/V8 and therefore needs its own distinct entitlement that current Tauri has no clean way to grant separately from the main app's. This rules Tauri out; §3 tests Electron against the same checks.

---

## 3. Does Electron hold up under the same real macOS entitlements checks?

### Why this was in question

`mcp-host-plan.md` §1 chose Electron over Tauri on the strength of the Tauri spike above, while noting Electron itself had not been built and verified the same way. That spike's own aside recorded why: a separate Electron test "never launched a process at all: the `electron` binary resolved and executed but reported a plain Node version rather than initializing, with no window and no process visible afterward," with the cause unisolated. This spike re-ran that attempt to find the cause, then built the kind of evidence the Tauri spike did: a real main-process workload, ad-hoc signed, under the hardened runtime, including the direct counterpart to Tauri's entitlement-leakage defect.

### The root cause of the earlier inconclusive attempt: an inherited `ELECTRON_RUN_AS_NODE`

The shell the earlier attempt ran in inherits `ELECTRON_RUN_AS_NODE=1` from an Electron-based host process, and that variable makes any Electron binary run as plain Node instead of initializing the app framework, matching the symptom exactly. Confirmed directly: a minimal app (disabling hardware acceleration, then loading a hidden window) run with the variable inherited exits 1, Electron's own `app` export undefined, `TypeError: Cannot read properties of undefined (reading 'disableHardwareAcceleration')`, with Node reporting its own version in the trace footer (`Node.js v24.22.0`), the "plain Node version" the earlier attempt described. The same app, run with the variable unset (`env -u ELECTRON_RUN_AS_NODE`), starts cleanly: `app.whenReady()` fires, a window loads, and `process.versions` reports a real Electron process (`electron: "44.8.0"`, `chrome: "152.0.7977.167"`, `v8: "15.2.124.43-electron.0"`), not Node's own version. The earlier attempt's failure is fully explained by this one variable; every command below ran under `env -u ELECTRON_RUN_AS_NODE`.

### Setup

Scope, matching the Tauri spike's own constraint: macOS only, ad-hoc signing only, since no real Apple Developer certificate exists in this environment; this does not test a Linux keyring equivalent. Versions, read from `npm view` at the time: `electron` 44.8.0 (44.9.0 is current as this was written, one patch behind; nothing below is specific to that patch version), `@electron/packager` 20.3.0, `@electron/osx-sign` 2.7.1, `@electron/fuses` 2.1.3, all current. Run on macOS 27.2 (build 26B5112a), arm64.

A minimal app and a small main-process workload were built fresh in a scratch directory outside any repository checkout, with nothing added to this project's own dependencies.

### A minimal app launches cleanly once the variable is unset

Covered above as the root-cause reproduction: exit 0, `app.whenReady()` fires, a `BrowserWindow` loads a trivial page.

### Host-core-shaped work in the main process, and the control that isolates `allow-jit`

A workload modelled on what host-core would actually do in the main process ([§2.4](mcp-host/mcp-host-plan.md#24-cre-main-process)): building functions at runtime with `new Function(...)`, a hot loop, and a real network round trip to a loopback server started in the same process, mirroring `mcp-client`'s own tests against an in-process server.

Packaged with `@electron/packager`, signed ad-hoc with `@electron/osx-sign` under the hardened runtime (`--options runtime`; `codesign -dv` shows `flags=0x10002(adhoc,runtime)`, `TeamIdentifier=not set`), with `com.apple.security.cs.allow-jit`. Launch: exit 0, the workload's own log lines confirm each step (the `new Function` results, a hot loop's accumulator, and a `200` response from the loopback server), run from the signed, packaged binary rather than from source.

One fix was needed to get there, an artifact of ad-hoc signing rather than a shipping requirement: signing the main executable and its framework separately under the hardened runtime, each ad-hoc, makes dyld refuse to load the framework (exit 134, `Library not loaded: ... not valid for use in process: mapping process and mapped file (non-platform) have different Team IDs`). Library validation under the hardened runtime accepts a library signed by Apple or sharing the main executable's own Team ID; an ad-hoc signature carries no Team ID at all, so an ad-hoc main binary can load only platform libraries unless library validation is disabled for it. A Developer ID build signs the main executable and its framework with the same real Team ID, satisfying library validation as designed, so it does not need this entitlement, and should not carry it: `com.apple.security.cs.disable-library-validation` lets the main process load a library from any signer at all, which defeats part of what the hardened runtime is for and makes Gatekeeper's own check of the app more demanding. This fix is therefore specific to testing ad-hoc here, not a requirement this plan should carry into a signed build.

Control, isolating `allow-jit` as the sole variable: the identical build, re-signed with `disable-library-validation` alone and `allow-jit` removed, crashes instead of completing the workload: exit 133 (128 + 5, `SIGTRAP`), `Fatal process out of memory: Failed to reserve virtual memory for CodeRange`, V8 unable to map executable memory under the hardened runtime without that entitlement. This is the same crash signature, by the same mechanism, that the Tauri spike recorded for its Node sidecar, confirming the requirement is V8's, not specific to either framework.

### The entitlement-leakage counterpart to Tauri's defect: confined, but only through a non-obvious API

The direct counterpart to the Tauri spike's finding: a restricted entitlement, `com.apple.developer.associated-domains` (the same key used there), placed on the main app only, then every binary in the packaged app inspected for it.

The first attempt found nothing that was asked for, and something that was not: passing `entitlements` as a plain file-path string to `@electron/osx-sign`'s top-level `sign()` call was silently ignored for every file, main binary included, which instead received the package's own built-in per-role default templates (`default.darwin.plist` for main; `default.darwin.plugin.plist`, `default.darwin.gpu.plist` and `default.darwin.renderer.plist` for the three named helpers). Reading `@electron/osx-sign`'s own source confirmed why: its per-file signing loop only ever reads entitlements from an `optionsForFile(filePath, { platform })` callback, and a plain top-level `entitlements` string is never consulted there at all.

What `default.darwin.plist` actually grants the main app matters on its own: `allow-jit` plus `com.apple.security.device.audio-input`, `com.apple.security.device.bluetooth`, `com.apple.security.device.camera`, `com.apple.security.device.print`, `com.apple.security.device.usb`, `com.apple.security.personal-information.location` and `com.apple.security.personal-information.photos-library`, silently letting the main process ask for camera, microphone, Bluetooth, USB, printing, location and photo-library access, independent of anything the caller asked for. This conflicts directly with [§2.4](mcp-host/mcp-host-plan.md#24-cre-main-process)'s own requirement to refuse permission requests such as camera or microphone. An entitlement doesn't grant access by itself: macOS still shows the person its own permission prompt, and Apple's camera entitlement reference says "the user must explicitly grant permission for each app to access cameras". But without the entitlement, the hardened runtime refuses access before any prompt, so a build signed through `@electron/osx-sign`'s defaults opens a request the plan means to close at the operating system's level. This is its own footgun, independent of Tauri's: where Tauri over-grants by copying the whole entitlements file onto every sidecar, the naive `@electron/osx-sign` call ignores the caller's intended entitlements entirely and substitutes its own, broader ones on the main app instead, an over-grant of a different kind.

Supplying `optionsForFile` instead, returning the restricted entitlements file only when the file being signed is the app bundle itself and a harmless `allow-jit`-plus-`disable-library-validation` file otherwise (`disable-library-validation` here for the same ad-hoc-signing reason as above, not something a Developer ID build would need either), produced the intended split. `codesign -d --entitlements -` confirmed it on every binary: the main app alone carries `com.apple.developer.associated-domains`; all four helpers (GPU, Plugin, Renderer and the base Helper) carry only `allow-jit` and `disable-library-validation`, none of them the restricted entitlement. Unlike Tauri, Electron's own signing tool does not leak a restricted entitlement to any helper, once it is told each binary's entitlements explicitly, and once those entitlements are the caller's own rather than `@electron/osx-sign`'s broader defaults.

As the Tauri spike's own nuance predicted, ad-hoc signing still kills the main app outright: launching it directly exits 137 (`SIGKILL`), and the unified log names the exact cause, matching the Tauri sidecar's kill nearly verbatim:

```
amfid: [com.apple.MobileFileIntegrity.framework:default] Restricted entitlements not validated, bailing out.
  Error Domain=AppleMobileFileIntegrityError Code=-427 "Unable to retrieve certificate chain"
amfid: [com.apple.MobileFileIntegrity.framework:default] Adhoc signed app with restricted entitlements detected
amfid: .../HostCoreSpike not valid:
  Error Domain=AppleMobileFileIntegrityError Code=-424 "The file is adhoc signed but contains restricted entitlements"
```

So the evidence here is the entitlements each binary carries, as expected going in, not a successful launch: no helper picks up a restricted entitlement it has no business holding, but the main app still needs a real certificate before a restricted entitlement can be used at all.

### The asymmetric case: not tested, since it needs a real certificate and profile

As with the Tauri spike's equivalent note, the case that matters most, a main app holding a real Developer ID certificate and a matching provisioning profile, with helpers that hold neither, needs credentials this environment does not have, so this spike does not test it. What was confirmed here, no leakage once entitlements are set per file through this project's own choice of API, is the mechanism that case depends on.

### `safeStorage`'s keychain round trip

`safeStorage.isEncryptionAvailable()` returned `true` in the signed, packaged app's main process. An `encryptString`/`decryptString` round trip on a test string succeeded (ciphertext 35 bytes for a 29-byte plaintext, consistent with Electron's own `v10` AES-GCM prefix and tag overhead), the decrypted value matching the original exactly.

No GUI keychain prompt appeared. `safeStorage` instead created a generic password item directly in the login keychain, named after the app with a `Safe Storage` suffix (account named with a `Key` suffix), the same naming convention already visible on this machine for other Chromium- and Electron-based apps (Chrome, Zoom and Steam each have their own). The app name used is `app.getName()`'s default, the nearest `package.json`'s own `name` field, not the packaged bundle's display name, worth knowing since a build pipeline that sets one but not the other would see a keychain item named after the wrong one. The test item was deleted immediately after confirming it.

### The fuses this plan requires, verified read back after signing

`@electron/fuses`' `flipFuses` set the five fuses [§2.4](mcp-host/mcp-host-plan.md#24-cre-main-process) requires: `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on. `getCurrentFuseWire` read every one back as set, both immediately after flipping and again after the final hardened-runtime signing pass that necessarily follows it, since flipping a fuse patches the binary, which invalidates any existing signature. The app, packaged with its default `app.asar` already in place, still launched cleanly afterward and completed the same JIT-plus-loopback workload as the control above, confirming `OnlyLoadAppFromAsar` does not stop the app's own code from running from inside the archive it is required to run from.

### Outcome

| Check                                                   | Verdict                                  | Evidence                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Launch, variable unset                                  | Pass                                     | Exit 0; real Electron `process.versions`                                                                                                 |
| Main-process JIT and loopback workload                  | Pass                                     | Exit 0; `new Function`, hot loop and a `200` loopback response all logged                                                                |
| Control: same workload, no `allow-jit`                  | Fails the same way Tauri's sidecar did   | Exit 133, `SIGTRAP`, CodeRange out-of-memory                                                                                             |
| Entitlement leakage to a helper                         | None, once entitlements are set per file | `codesign -d --entitlements -` on all 5 binaries                                                                                         |
| Main app launch with the restricted entitlement, ad-hoc | Killed, as Tauri's was                   | Exit 137; amfid Code -424                                                                                                                |
| Asymmetric case (valid main, bare helpers)              | Not tested                               | Needs a real Developer ID certificate and provisioning profile, which this environment lacks; the same holds for Tauri's equivalent case |
| `safeStorage` round trip                                | Pass                                     | Encrypt/decrypt match; keychain item created silently, then deleted                                                                      |
| Required fuses, read back after signing                 | Pass                                     | All 5 read back set; app still launches                                                                                                  |

Electron clears the same bar Tauri failed: no entitlement leakage to a helper, confirmed by inspection rather than assumed from the absence of a known bug report, provided the build gives each binary its entitlements explicitly rather than relying on `@electron/osx-sign`'s own defaults; and every other mechanism this plan's §2.4 depends on (a main-process workload modelled on host-core running under `allow-jit`, `safeStorage`, the required fuses) verified working under the hardened runtime. The one gap Tauri also has, the asymmetric real-certificate case, needs the same real signing credentials for both frameworks; it does not favour either one over the other.

---

## Where this lands

- `mcp-host-plan.md` §1
- `mcp-host-plan.md` §2.4
- `mcp-host-plan.md` Phase 5
