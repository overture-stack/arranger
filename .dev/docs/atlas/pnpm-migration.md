# pnpm migration: scoping findings

Detailed reasoning behind roadmap §3.3 (Migrate from npm to pnpm), verified 2026-08-14. Roadmap
keeps the actionable checklist; this doc keeps the why and the still-open questions.

## Workspace configuration has no package.json option

Confirmed directly: pnpm requires a separate `pnpm-workspace.yaml` at the repo root for the
package-glob list (and catalogs, and pnpm-specific overrides). There was once a `pnpm` key in
`package.json` for some settings; that's deprecated too, pnpm no longer reads it. The stated
reason is that config living in `package.json` breaks the `pnpm fetch` command. Unlike `wireit`
(collocated under its own `package.json` key), there's no equivalent shortcut here.

## The sibling-dependency rewrite is publish-time, not merge-time

`workspace:^` (or `workspace:*`/`workspace:~`) is a static string, identical on every branch,
exactly like `file:../sibling` today: merging `main` into `release-test` stays as conflict-free
as it already is (§2's reasoning applies unchanged). The rewrite happens only when `pnpm publish`
actually runs for a given package, at that moment it reads the sibling's currently-committed
`version` field on that same commit and substitutes it into the published manifest. Nothing about
the version-bump step (§4/§5's semver-judgement work) changes; only the dependent-package rewrite
step disappears, along with `scripts/fix-workspace-deps.mjs` and its Jenkins `git checkout`
revert line.

**Requires Jenkins to actually call `pnpm publish`, not `npm publish`.** `workspace:^` means
nothing to npm; if the publish stage kept invoking `npm publish` after the package.json syntax
switched, it would either error or publish the literal string.

## New risk, not previously documented: pnpm blocks dependency install scripts by default

pnpm v10 (January 2025) flipped this: a dependency's lifecycle scripts (postinstall, etc.) are
blocked unless explicitly allowlisted via `pnpm approve-builds` (or a committed
`onlyBuiltDependencies` list). `strictDepBuilds`, defaulting to `true` since late 2025, makes a
blocked script **fail the install**, not just skip it silently. `tsup` (used to build `sqon` and
`types`) depends on `esbuild`, which has a native postinstall step, so a first `pnpm install`
after migrating will very likely fail until this is allowlisted. This needs to be part of the
migration checklist, and CI needs either a committed allowlist or `pnpm approve-builds --all`, not
an interactive prompt Jenkins can't answer.

## `ts-patch`: resolved via prototype (2026-08-15)

Built a disposable two-package pnpm workspace: one package mirroring `components`/`graphql-router`'s
pattern (`ts-patch` properly declared as its own devDependency), one mirroring `sqon`/`types`'s
actual current pattern (runs `ts-patch install -s` via `prepare`, but never declares `ts-patch`
itself). Result, definitive, not just "installed without erroring": `pnpm install` failed outright
for the `sqon`/`types`-style package (`sh: ts-patch: command not found`), confirming the missing
declaration is a real phantom dependency, exactly the kind `depcheck` can't see, since it's a
shell-invoked binary, not a JS import (see the phantom-dependency audit above, which correctly
didn't catch this for the same reason). Declaring `ts-patch` properly fixed it immediately, and
the properly-declared package's `tsc` build was verified end to end: the emitted `dist/index.js`
showed `require("./bar")`, not the raw `#bar` alias, confirming `typescript-transform-paths`'s
transform actually took effect on pnpm's resolved TypeScript install, not just that the install
script ran. **Conclusion: `ts-patch` itself is fully compatible with pnpm. The only real risk was
already identified: `sqon` and `types` need to add `ts-patch` to their own `devDependencies`,
matching what `components`/`graphql-router` already do correctly.**

**This does not mean pnpm replaces `ts-patch` or makes it unnecessary.** The two solve unrelated
problems: `ts-patch` enables custom TypeScript compiler transformers (`typescript-transform-paths`),
which has nothing to do with which package manager installs dependencies. `pnpm patch` (mentioned
in an earlier draft of this doc as a possible alternative, in case `ts-patch` turned out
incompatible) was never tested and isn't needed: `ts-patch` works, so there's nothing to replace
it for. `ts-patch` stays in the toolchain, doing exactly what it does today, for every package
that uses it.

## `wireit`: not prototyped, developer confidence accepted as-is

Confirmed only that it runs as a script launcher via pnpm (see above). Its cross-package
dependency graph under pnpm workspaces specifically remains unverified by prototype; the developer
is confident this isn't a real risk, so no further verification was done here. Revisit only if the
full trial migration surfaces something.

## Turborepo is already in the mix, separately from wireit

`turbo.json` already exists (§3.3's existing checklist references removing
`dangerouslyDisablePackageManagerCheck` from it), and `.turbo/turbo-build.log` files were found
leaking into `sqon`'s published tarball before the `files`-field fix, confirming Turbo is already
doing cross-package orchestration in this repo, distinct from `wireit`'s per-package build
caching. Turbo's own pnpm-workspace support is mature and widely used; it's not carrying the same
open-question status as `wireit`/`ts-patch` above.

## Existing verification tooling already covers part of this

`scripts/verify-pack.mjs` (`npm run release:check`) already exists and already checks for both
`file:` and `workspace:` prefixes in publishable modules' dependency specs, specifically so it
stays valid across this migration. It checks the *source* `package.json` files, though, not the
actual packed tarball, so it can't catch a case where the rewrite ran correctly but something else
corrupted the published output. Worth pairing with an actual `pnpm pack`/`pnpm publish --dry-run`
check per package post-migration (matching how `fix-workspace-deps.mjs`'s current behaviour was
verified today, against the live npm registry, not just the doc describing it) rather than relying
on the source-file check alone.

## Phantom-dependency audit (2026-08-15): real findings, before touching pnpm at all

Ran `npx depcheck@1.4.7` against every workspace's own directory (not the repo root, so each
check is scoped to that package's own `package.json`). "Unused dependencies" is ordinary
cleanliness debt (declared but not imported) and not a pnpm risk; only "missing dependencies"
(imported but not declared, resolving today only via npm's hoisting) matters here. One category
discounted outright: `modules/types` flagged `#tools` as missing, that's a Node.js subpath-import
alias (`"imports": {"#*": "./src/*"}`, used across this entire monorepo), not a real package;
depcheck doesn't understand that syntax and this pattern would recur in any other package's
report too if it happened to show up.

**Confirmed real, will break under pnpm's strict resolution unless fixed first:**

- `apps/search-server`: `lodash-es`, used in `src/configs/fromFiles/fileHandlers.ts`, not declared
  (currently resolves via a sibling's hoisted copy).
- `integration-tests/import`: `@jest/globals`, used in `test.ts`, not declared.
- `integration-tests/mcp-server` and `integration-tests/server`, same pattern in both:
  `@overture-stack/arranger-types` and `dotenv`, both used in `test/index.test.ts`, neither
  declared. Same two packages, same two gaps, in both, looks like a shared test template that
  never had its own deps declared.
- `modules/components`, the largest and most concerning set, all in real source files, not just
  config: `query-string` (`src/Location.jsx`), `@emotion/is-prop-valid` (`src/Tooltip/StyledTooltip.ts`),
  `prop-types` (`src/Flex/Column.js`). Plus two dev-tooling-only gaps: `eslint-plugin-import` and
  `globals`, both used in `eslint.config.js`, and `babel-polyfill`, used in `.storybook/config.js`.
- `modules/graphql-router`: `@graphql-tools/mock` (`src/schema/index.ts`) and `graphql-tools`
  (`src/admin/types.ts`), both in real source files.

**Clean, no missing dependencies found:** `apps/mcp-server`, `modules/charts`, `modules/sqon`.

**Conclusion:** the biggest risk area named before running this (`modules/components`'s older,
less-touched code) was confirmed, not just guessed at, three real source-file gaps plus two
tooling-config ones. `graphql-router`'s Apollo Server 3 tree, also flagged as a likely spot
beforehand, turned up two real gaps as well. Fixing all of the above (declaring the actual
dependency in each package's own `package.json`) is independently worth doing regardless of pnpm,
and shrinks the single biggest unknown in the migration to whatever a full trial run still finds
beyond this list.

## Phantom-dependency fixes: applied (2026-08-15)

All six packages from the audit above now correctly declare what they actually import: `lodash-es`
(`apps/search-server`), `@jest/globals` (`integration-tests/import`), `@overture-stack/arranger-types`
and `dotenv` (both `integration-tests/mcp-server` and `integration-tests/server`), `query-string`,
`@emotion/is-prop-valid`, `prop-types`, `eslint-plugin-import`, `globals`, and `babel-polyfill`
(`modules/components`), `@graphql-tools/mock` and `graphql-tools` (`modules/graphql-router`), and
`ts-patch` (`modules/sqon` and `modules/types`, per the prototype finding above). Verified with a
second `depcheck` pass (clean on all six) and the full test suite plus a typecheck pass on the
touched packages.

**One real catch during verification, not just "current" but "compatible":** the first pass used
`query-string@^9.5.0` (the current published version, correctly verified via `npm view`), which
broke `integration-tests/import`'s test suite outright: `query-string@9` is ESM-only (`"module"`
entry point, no CJS `main`), but `modules/components` builds to CommonJS via Babel, and a CJS
`require()` cannot load a pure-ESM package. Confirmed empirically (installed `query-string@7`,
the last version with a plain CJS entry point, and the test passed) rather than reasoned from
registry metadata alone, since the registry's `exports`/`main` fields for the older majors weren't
conclusive on their own. Pinned to `^7.1.3`; its `parse(string)` API is the library's original,
stable core feature, unchanged across every major version, so no functional gap versus what
`src/Location.jsx` actually calls. **Worth generalizing:** "current on npm" and "compatible with
this package's actual module system" are different checks; verifying a version is real and
current doesn't confirm it'll actually load under the consuming package's build target.

## Build tooling for `modules/components`: not forced by this migration

pnpm doesn't mechanically require changing `components`' babel-based build; the only pnpm-relevant
risk is the generic phantom-dependency one (a babel preset/plugin resolved today via hoisting,
without being `components`' own declared devDependency). Whether to modernize the build tool is a
separate, independent decision. If it comes up: Rollup is the better fit over Vite or webpack
specifically for this package, since it publishes an unbundled, per-file-transpiled library (the
correct shape for something meant to be tree-shaken by the consumer's own bundler), and Vite's
differentiating value (dev server, HMR) is irrelevant to a publish build. Vite's own library mode
is Rollup underneath anyway, so reaching for it here mostly adds an abstraction layer without the
part of Vite that's actually useful. Webpack is the weaker fit of the three for tree-shakeable,
multi-file library output specifically, that's Rollup's core design goal, not webpack's.

## Resolved: how Changesets and `workspace:` protocol actually divide the work

§3.1 (Changesets)'s own "Cleanup when this lands" note claimed `changeset version` rewrites
`file:` deps to real version ranges before publishing. Confirmed 2026-08-15 that this is
inaccurate: `workspace:^` means "always use the local version," there is no version number in
that string for Changesets, or anything else, to rewrite. `updateInternalDependencies` does
something adjacent but genuinely different: when a sibling bumps, it decides whether the
*dependent* package also needs its own new version published (a cascading bump), even if the
dependent's own source didn't change, since its resolved dependency tree did. The actual
`workspace:^` -> real-semver substitution happens exclusively via pnpm's own publish step (see
above); Changesets is not involved in it at all.

**Division of labour, confirmed clean, not overlapping:** pnpm's `workspace:` protocol solves the
mechanics of referencing an actively-developed sibling without hardcoding a real version number
anywhere `main` is supposed to stay free of one. Changesets solves the decision problem, what
severity each change is, aggregated across however many PRs landed since the last release, plus
changelog generation and the cascading-bump decision above. Neither one's job overlaps with the
other's.

**Consequence for phase ordering: §3.3 (pnpm) needs to land before §3.1 (Changesets), not after,**
despite the numbering. Changesets' internal-dependency cascade detection is built around real
semver or `workspace:` references, not `file:`. Adopting Changesets first would leave it with
nothing sensible to cascade against for any of the seven packages' sibling deps.
