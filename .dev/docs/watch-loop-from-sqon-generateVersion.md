# Postmortem: `sqon`'s `generateVersion.mjs` created a self-triggering rebuild loop

Written to capture the incident in full, and to serve as source material for a general
convention (Arranger-specific today; see the note at the end on what to generalize when this
gets decanted into agentics).

## What happened

Earlier in this session, `modules/sqon`'s `readFileSync`-of-`package.json`-at-runtime bug (broke
browser bundling) was fixed by moving version resolution to build time: a new
`scripts/generateVersion.mjs`, wired as `prebuild`/`pretest`, stamps the package's version into
`src/version/generated.ts` as a literal.

That fix was verified thoroughly against its own stated goal: tests passed, the build was clean of
`node:fs`, the JSON Schema output was unaffected. What wasn't checked: `modules/sqon` already had a
`watch` script, `nodemon -w src -e ts --exec "npm run clear:dist && npm run build"`, that watches
`src/**/*.ts` for changes and reruns the build on each one. `src/version/generated.ts` is a `.ts`
file, inside `src`, so writing it unconditionally on every `build` created a loop:

1. A real source change (or the loop's own previous iteration) triggers nodemon.
2. Nodemon runs `clear:dist && npm run build`.
3. `prebuild` runs `generateVersion.mjs`, which unconditionally rewrites `src/version/generated.ts`.
4. That write is itself a `.ts` change under `src/`, which nodemon sees.
5. Back to step 2, forever.

Rakesh Mistry (OHCRN) hit this via `npm run dev:server`, which runs `sqon:watch` (this exact
script) concurrently with `types:watch`, `graphql-router:watch`, and `server:dev`. He correctly
diagnosed the loop mechanism from the symptoms alone before this was confirmed here.

**It was very likely worse than a single-package loop.** `modules/types`'s own watch script is
`nodemon -w src -w ../sqon/dist -e ts --exec "npm run build"`, it explicitly watches `sqon`'s
*built output* directory too, so it rebuilds whenever `sqon` produces a new `dist/index.d.ts`.
Every iteration of the `sqon` loop above rebuilds `sqon`'s `dist/`, which would have retriggered
`types`'s watcher as well, cascading the runaway rebuild into a second package rather than staying
contained to one. This is why `dev:server` most likely looked fully broken (CPU pegged across two
concurrently-running rebuild loops) rather than just noisy in one.

## The fix

Two independent measures, deliberately not just one:

1. **`nodemon --ignore src/version/generated.ts`** in `sqon`'s `watch` script: the direct,
   explicit fix for the known trigger. Nodemon never considers a change to this path a reason to
   restart, full stop.
2. **`generateVersion.mjs` now compares against the existing file's content and skips the write if
   unchanged.** This is the general-purpose defensive practice: it breaks the loop even for a
   watcher that doesn't know to ignore this specific path (an editor's own file watcher, a
   differently-configured future watch script, `git status` noise), and means a legitimate version
   bump mid-session causes exactly one extra rebuild, not an infinite one.

Verified empirically, not just reasoned through: ran the `watch` script in a bounded background
window, triggered one real source change, confirmed exactly one rebuild cycle followed by
quiescence, not a loop. (See this session's transcript around 2026-07-30 for the actual log
output.)

## The general pattern, extrapolated

Surveyed every watch/dev script across the monorepo (`modules/*/package.json`,
`apps/*/package.json`) to see how common this shape of risk is:

| Package                | Watches                                                          |
| ----------------------- | ----------------------------------------------------------------- |
| `modules/charts`        | `vite build --watch` (own `src` only)                              |
| `modules/components`    | `build -- --watch` (own `src` only)                                |
| `modules/graphql-router`| `build -- --watch` **and** a separate `tsx watch` dev-server process, both own `src` only |
| `modules/sqon`          | `nodemon -w src` (own `src` only, now with the `generated.ts` ignore) |
| `modules/types`         | `nodemon -w src -w ../sqon/dist` (own `src` **and** a dependency's build output) |
| `apps/mcp-server`       | `tsx watch` (own `src` only)                                       |
| `apps/search-server`    | `tsx watch` (own `src` **and** `../../modules/types/dist`, `../../modules/graphql-router/dist`) |

**This monorepo's `dev:server` architecture deliberately chains watchers across package
boundaries**: a downstream package's dev loop watches both its own source and its direct
dependencies' build output, so editing a shared module cascades a rebuild through everything that
depends on it, without needing a single top-level orchestrator to know the whole dependency graph.
That's a reasonable, intentional design. It also means **the blast radius of a mistake like this
one is not contained to the package you're editing**: an unconditional write into a watched path
in a widely-depended-on package (`sqon`, `types`) can cascade into every downstream watcher, not
just loop locally. The more central a package is in the dependency graph, the larger the blast
radius of this specific mistake in that package.

**The general, project-independent version of the rule:**

> Before adding any new file-write side effect to a package, especially one wired into a build or
> test lifecycle hook (`prebuild`, `pretest`, `postinstall`, a codegen step, an auto-formatter
> triggered on save), check whether *any* watch/dev-loop process in the same package, or in a
> downstream package that watches this one's build output, monitors the directory being written
> into. Verifying the new step against its own stated goal (does the build work, do the tests
> pass) does not exercise a separate watch script at all, that's exactly why this is easy to miss:
> the watch script isn't part of the direct call path you'd naturally run to check your own
> change.

This generalizes beyond nodemon specifically: any chokidar-based watcher (webpack `--watch`,
`vite --watch`, `tsx watch`, IDE auto-reload, a pre-commit hook watching staged files) that
reacts to filesystem changes as an implicit, always-on trigger is equally exposed if a build step
writes into its watched scope.

## Note for decanting into an agentics convention

Same relationship to `release-process.md`: this is Arranger-specific today (real package names,
real script names, this monorepo's specific cross-package watch-chaining choice), written as
source material for a general convention, not the convention itself. What should generalize:
the check itself ("does this write land inside something already being watched, in this package
or a downstream one"), not the specific mechanism (nodemon `--ignore`, this particular idempotent-
write pattern) or Arranger's specific dependency-chained watch architecture.
