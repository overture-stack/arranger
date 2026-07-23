# Arranger release process: rc tags through to real releases

This document describes, in full detail, how Arranger moves code from `main` through
release-candidate tags to a real npm/Docker release. It's written to capture everything
needed to later abstract a general "monorepo rc-then-release" convention for the agentics
template: branching, versioning philosophy, exact commands, conflict-resolution rules,
commit conventions, semver-judgement heuristics, and the Jenkins mechanics that gate all of it.

**Scope:** this is Arranger-specific today (real package names, real branch names). Treat it
as the source material for a future agentics convention, not the convention itself: anything
Arranger-specific (package names, the exact `modules/*` glob, `release-charts`) should be
generalized when it's decanted.

---

## 1. Branching model

| Branch           | Role                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`           | Code only. Every `package.json` version is pinned at the fixed placeholder `0.0.0-dev`. Builds, runs tests, Docker image tagged with commit SHA + `edge` (roadmap: `edge` -> `next`). Deploys to `overture-dev`. No npm publish.                                                                                                                                                                                |
| `release-test`   | Release-candidate staging. Carries real semver versions with `-rc.N` prerelease suffixes. Every merge from `main` lands here first. Jenkins publishes npm packages under the `rc` dist-tag and Docker images tagged with the rc version, from this branch.                                                                                                                                                      |
| `release`        | The real release. Same structure as `release-test` but versions have no `-rc.N` suffix. Jenkins publishes npm under `latest` and Docker with the version + `latest` tag.                                                                                                                                                                                                                                        |
| `release-charts` | Temporary workaround (marked TEMP in the pipeline) to publish `modules/charts` on its own cadence, from before charts was fully integrated into the normal `modules/*` publish loop. Should be revisited: as of the 2026-07-20 round, charts is flowing through the normal `release-test` process successfully, so this workaround may now be redundant. Not confirmed removed; flag for cleanup, don't assume. |

**Key convention:** this is a team-wide pattern across Overture repos, not Arranger-specific,
though not every repo has it fully implemented yet.

**Why no separate ephemeral "rc branch"?** The documented process (in older notes) described
branching a throwaway RC branch off `release`, merging `main` into it, bumping versions, then
merging that branch into `release`. In practice, that extra branch is unnecessary busywork:
`release-test` itself already plays that role permanently. You just work directly on
`release-test`, and it stays in sync with `origin/release-test` between rounds (verify with
`git rev-list --left-right --count release-test...origin/release-test` before starting; it
should read `0	0`). A throwaway branch only earns its keep if multiple people need to
collaborate on the same in-flight RC before it's ready to land on `release-test`, or if you want
to keep `release-test` itself always in a "known good, already published" state while iterating.

---

## 2. Versioning philosophy

- `0.0.0-dev` on `main` is a deliberate, fixed placeholder. It is never bumped on `main`, ever.
- Versioning is entirely a `release-test`/`release`-branch concern. Regular developers working
  on `main` are not expected to think about semver at all.
- This cleanly separates code concerns (`main`) from release concerns (`release-test`/`release`).
- Because `main`'s version field never actually changes relative to any merge base, **merging
  `main` into `release-test` never produces a real conflict on the `version` line** unless an
  adjacent line in the same package.json also changed on both sides (git's 3-way merge keeps
  whichever side actually changed the line; if only one side changed it, that side wins with no
  conflict). Confirmed empirically: in the 2026-07-20 round, all seven touched `package.json`s
  auto-merged with zero conflicts on the version field.

---

## 3. Jenkins pipeline mechanics (grounds everything below)

Pipeline file: `/Users/jrichardsson/Documents/sajter/jenkins-pipeline-library/vars/pipelineOvertureArranger.groovy`
(helper `step*` files load automatically via CasC, not explicitly imported).

**NPM publish stage** (`when { anyOf { branch 'release'; branch 'release-test' } }`):

```groovy
def npmTag = env.BRANCH_NAME == 'release' ? '' : '--tag rc'
...
for pkg in modules/*; do
    if [ -f "$pkg/package.json" ]; then
        name=$(node -p "require('./$pkg/package.json').name")
        local_version=$(node -p "require('./$pkg/package.json').version")
        dist_tag="rc"; [ "$BRANCH_NAME" = "release" ] && dist_tag="latest"
        remote_version=$(npm view "$name@$dist_tag" version 2>/dev/null || echo 0.0.0)
        if [ "$local_version" != "$remote_version" ]; then
            node scripts/fix-workspace-deps.mjs "$pkg"
            npm publish -w "$pkg" $npmTag
            git checkout "$pkg/package.json"
        fi
    fi
done
```

Consequences worth internalizing:

- **Only `modules/*` publishes to npm.** `apps/*` (`mcp-server`, `search-server`) are
  `"private": true` and never published; their `version` field only feeds Docker image tags,
  built and pushed in a separate stage keyed off `versionsMap['search-server']` /
  `versionsMap['mcp-server']` (read straight from each app's `package.json`).
- **The publish gate is "does local differ from what's already published under this dist-tag."**
  If you don't bump a package's version and its content changed, the pipeline will silently skip
  republishing it. There is no separate "did the code change" check for npm publish beyond this
  version-string diff (Turbo-based change detection is planned for the Docker stages, not this
  one, per roadmap Phase 2.x).
- **Docker tags reuse whatever version is in the app's `package.json` at build time.** If an
  app's code changed but its version didn't, and Docker change-detection is content/path-based
  (it is, on `release`/`release-test`), the image would rebuild and get retagged with the
  _same_ version string, silently overwriting a previously-pushed tag. So app versions should be
  bumped whenever their content changes too, even though nothing forces this the way the npm
  gate does.
- **`scripts/fix-workspace-deps.mjs`** rewrites any `file:../sibling` dependency in the package
  being published to `^<sibling's local package.json version>` immediately before `npm publish`,
  then the Jenkins loop does `git checkout "$pkg/package.json"` to discard that rewrite from the
  working tree afterward. This is explicitly marked as an interim measure ("remove when
  Changesets lands, Phase 3.1") until real workspace protocol support replaces it. It means: as
  long as every sibling package's version is correctly bumped in the same commit, publish-time
  dependency resolution just works, regardless of alphabetical publish order within the
  `modules/*` loop.

---

## 4. The RC promotion process: `main` -> `release-test`

Confirmed working end-to-end on 2026-07-20.

### Step by step

```bash
git checkout release-test        # verify first: git rev-list --left-right --count release-test...origin/release-test → 0  0
git merge --no-ff origin/main    # merge commit, not fast-forward
```

Expect:

- Every touched `package.json`'s `version` line auto-merges cleanly, keeping `release-test`'s
  current value (see §2 for why).
- `package-lock.json` conflicts almost every time (its diff between `main` and `release-test` can
  run into the thousands of lines). **Do not hand-resolve this.** Resolve by keeping the current
  branch's copy as-is:
    ```bash
    git checkout --ours package-lock.json
    git add package-lock.json
    ```
    It gets regenerated properly later, after the version bumps (below), by running `npm install`
    once at the repo root. Never try to manually merge conflict markers inside an autogenerated
    lockfile.
- Any other genuine source conflicts get resolved normally (rare in practice; most of the diff
  volume between `main` and `release-test` is new source code with no `release-test`-side
  divergence to conflict with).

Verify cleanly resolved, then commit:

```bash
git status --short | grep -E '^(U|AA|DD)'   # must be empty
git commit -m "Merge branch 'main' into release-test"
```

### Bumping versions

For each package whose content actually changed (see §5 for how to decide _how much_), edit its
`package.json` `version` field directly. (`npm version <ver> -w <workspace> --no-git-tag-version`
also works and guarantees valid semver formatting, but for a handful of files, direct edits are
less overhead and just as safe if you're careful.)

Then regenerate the lockfile against the merged + bumped state:

```bash
npm install   # from repo root, once, after all version bumps are applied
```

Stage exactly the changed `package.json`s plus `package-lock.json`, and commit **separately from
the merge**:

```bash
git add <bumped package.json files> package-lock.json
git commit -m "$(cat <<'EOF'
version bumps for all

sqon: 1.0.0-rc.1 -> 1.0.0-rc.2
types: 1.0.0-rc.2 -> 1.0.0-rc.3
graphql-router: 1.0.0-rc.3 -> 1.0.0-rc.4
components: 3.0.8-rc.2 -> 3.1.0-rc.1
charts: 0.1.0-rc.1 -> 0.1.0-rc.2
mcp-server: 0.1.0-rc.1 -> 0.1.0-rc.2
search-server: 3.1.0-rc.1 -> 3.1.0-rc.2
EOF
)"
```

**Why two commits, not one:** keeping "merge in main's code" and "here's the version-bump
decision" as separate commits makes the PR diff reviewable in two independent, meaningful
chunks: a reviewer can look at the bump commit alone to sanity-check the semver reasoning
without wading through the full code diff. This matches existing history on `release`/`release-test`
(e.g. `82563b8f Merge branch 'main' into release-test` followed by `10aedfd6 version bumps for all`;
`21511c01 Merge...` followed by `0ec58fc6 bump graphql-router@1.0.0-rc.3`). Commit message style
in this repo: short lowercase subject (`version bumps for all`, `bump X@version`, `bump rc 2
version for A, B and C`), optionally with a body listing `package: old -> new` for anything
touching more than one or two packages (the multi-line body format is a refinement introduced in
the 2026-07-20 round; earlier bump commits had no body at all).

### Handoff

The developer pushes `release-test` themselves once satisfied. Nothing here is auto-pushed. A PR
onto `release-test` gives other devs a chance to review before Jenkins builds/publishes it.

---

## 5. Deciding _how much_ to bump: the semver-judgement framework

This is the genuinely hard, non-mechanical part. The rule applied on 2026-07-20, and worth
carrying forward:

**Distinguish packages that have never shipped a real stable release from packages that have.**

- For a package where the npm `latest` dist-tag is itself just an old rc (or an artifact of
  first-publish), or the whole `x.y` line target has never been promoted past `-rc.N` (e.g.
  `sqon`, `types`, `graphql-router`, `charts`, and both apps in this round: none had ever shipped
  a stable `1.0.0`/`0.1.0`/`3.1.0` etc.), **just increment the rc counter on the current target
  base**, regardless of how large or "breaking" the accumulated diff looks. Prerelease versions
  carry no compatibility contract between each other; there is no real audience yet to break.
  Save the real severity call for whenever the actual stable release is cut.
- For a package with an actual shipped stable release already in the wild (in this round:
  `@overture-stack/arranger-components`, `latest` = `3.0.7`), apply strict semver against that
  real baseline: any change to an exported type or exported function's contract that could make
  previously-valid consumer code fail to compile or behave differently is a **major** bump, a
  backward-compatible addition is **minor**, and a pure behavior fix is **patch**. Don't default
  to "nobody will really notice" as a reason to under-bump: semver is a promise about the
  contract, not a bet on current usage patterns. That said, when the actual known consumer set
  is small, in-house, and can be coordinated directly (as here: two of three
  known-consumer repos were dead or non-interacting, and the third was the user's own to update
  on their own schedule), it's a legitimate, informed judgement call to relax the bump (this
  round: `components` went from a provisionally-suggested `4.0.0-rc.1` down to `3.1.0-rc.1`
  after checking real-world exposure of the one breaking exported-type change).

**Concrete example of a breaking-type-vs-runtime-behavior distinction that matters:** a rename
of a runtime string literal (e.g. an SQON op renamed `filter` -> `wildcard`) is _not_ necessarily
breaking if the schema still accepts both values as aliases in both read and write directions.
An exported TypeScript type changing from one shape to a structurally different (even if wider)
union _is_ a real breaking change for any consumer that does exhaustive discriminated-union
matching or that cross-references the old type from a sibling package directly, even if most
casual consumers (who treat the value as opaque) would never notice. Both facts can be true at
once; the semver call should be driven by the type-level contract, with the practical blast
radius as a separate, explicit judgement layered on top, not a replacement for it.

**Practical technique for classifying a large diff:** diff the actual exported entrypoint
(`src/index.ts` / the package's `exports` map) between the two branches first, before reading
the full internal diff. Anything not reachable from there can't be a public breaking change no
matter how large the internal diff is. Then check the internal diff specifically for: renamed
or removed exports, changed function signatures, changed shape of exported types/interfaces
used in other exported functions' signatures, and changed default behavior of anything with an
implicit default (e.g. a feature flag whose default value flips).

**Dependency-chain check:** packages that depend on a bumped sibling via `file:../sibling` don't
automatically need a bump just because the sibling bumped (their own `file:` reference doesn't
carry a version number to update, `fix-workspace-deps.mjs` reads whatever's currently on disk at
publish time, see §3). In practice, check whether each dependent already needs a bump for its
_own_ reasons; if none of the dependents are otherwise being bumped this round, but their
behavior meaningfully changes just from a sibling update, bumping them anyway is worth
considering (didn't come up on 2026-07-20: every dependent already had independent reasons).

---

## 6. The final release: `release-test` -> `release`

Once the RC(s) on `release-test` are confirmed good (external validation, whatever "confirmed"
means for that release), repeat the **identical two-commit process one level up**:
`release-test` now plays the role `main` played in §4, and `release` is the target.

```bash
git checkout release
git merge --no-ff origin/release-test
# same package-lock.json handling: git checkout --ours package-lock.json; regenerate via npm install after bumps
```

The only difference is the bump commit: strip the `-rc.N` suffix back to the plain semver rather
than incrementing anything (`1.0.0-rc.2` -> `1.0.0`, `3.1.0-rc.1` -> `3.1.0`, `0.1.0-rc.2` ->
`0.1.0`). Jenkins then publishes those under the real `latest` npm dist-tag and Docker
`latest`/version tag instead of `rc` (see §3's `npmTag`/`dist_tag` logic).

---

## 7. Known interim workarounds and their planned retirement

- **`scripts/fix-workspace-deps.mjs`** (file: dependency rewriting at publish time): explicitly
  temporary, removed once Changesets adopts real workspace-protocol dependency handling
  (roadmap Phase 3.1). When that lands: delete the script, delete its invocation and the
  `git checkout` restore line from the Jenkins publish loop, delete the corresponding tech-debt
  entry.
- **Manual version bumping via direct `package.json` edits + a hand-written bump commit**: this
  entire §4/§5 process is what Changesets (roadmap Phase 3.1) is meant to replace. Changesets'
  model: each PR author runs `npx changeset` and declares which packages changed and at what
  semver level _while the change is fresh in their head_, instead of someone reconstructing
  severity forensically by diffing branches after the fact (which is what §5 above is: a manual,
  retrospective version of exactly what Changesets automates going forward).
- **Enhancement idea layered on top of Changesets** (not yet built, proposed 2026-07-20): a CI
  check that diffs each package's exported API surface against its last published version and
  posts a suggested severity as a PR comment or pre-fills the `changeset` prompt. This doesn't
  replace the author's judgement (per §5, breaking-vs-additive calls stay too fuzzy to fully
  automate reliably) but gives them a concrete starting point instead of deriving severity from
  scratch, which is exactly what takes the most time in this manual process. Logged in
  `.dev/roadmap.md` under §3.1.
- **`release-charts`**: workaround predating charts' integration into the normal `modules/*`
  publish loop. Possibly redundant now; not confirmed removed, flag for review rather than
  assuming it's dead.

---

## 8. Worked example: the 2026-07-20 round

For concreteness, here's the actual round this document was extracted from.

**Starting state (`release-test`, already published under npm `rc` dist-tag):**

| Package                                       | Version    | Last real stable (`latest` tag)                            |
| --------------------------------------------- | ---------- | ---------------------------------------------------------- |
| `@overture-stack/sqon`                        | 1.0.0-rc.1 | none (rc.1 is also `latest`, an artifact of first publish) |
| `@overture-stack/arranger-types`              | 1.0.0-rc.2 | none (`latest` = 1.0.0-rc.1, same artifact)                |
| `@overture-stack/arranger-graphql-router`     | 1.0.0-rc.3 | none (`latest` = 1.0.0-rc.1, same artifact)                |
| `@overture-stack/arranger-components`         | 3.0.8-rc.2 | **3.0.7** (real shipped release)                           |
| `@overture-stack/arranger-charts`             | 0.1.0-rc.1 | none (`latest` = old separate `0.0.1-beta.16` line)        |
| `arranger-mcp-server` (app, not published)    | 0.1.0-rc.1 | n/a                                                        |
| `arranger-search-server` (app, not published) | 3.1.0-rc.1 | n/a                                                        |

**What changed on `main` since (high level, per package):**

- `sqon`: absorbed the standalone `sqon-builder` package's builder API directly into this
  package (`SqonBuilder`, `addFilterClause`, etc.), grounded in this package's own Zod schema
  instead of `sqon-builder`'s type-intersection approach. Renamed some exported schema/type names
  (`SqonGroupSchema`->`SqonCombinationSchema`, `FuzzyFilterSchema`->`WildcardFilterSchema`),
  tightened some validation (e.g. `between` now strictly requires a 2-element array). Switched
  build tooling from `tsc` to `tsup` with dual ESM/CJS output.
- `types`: additive config flag constants (`DISABLE_GRAPHQL_INTROSPECTION`,
  `ENABLE_GRAPHQL_BATCHING`), replaced a never-fully-implemented `DISABLE_SETS` flag with
  `ENABLE_SETS` (default flipped from on to off), widened a string-handling utility's parameter
  type (no runtime behavior change).
- `graphql-router`: new `nodesFilter` argument on the network/federated-search resolvers to scope
  queries to specific nodes, a real bug fix (inverted SQON validation logic that silently
  accepted invalid filters and rejected valid ones), wired up the new `types` flags, dependency
  swap from `sqon-builder` to the absorbed `@overture-stack/sqon`. No public export surface
  changes (internal `catalog`->`catalogue` renames aren't externally visible).
- `components`: additive `networkNodesFilter` context field (backing the network-search
  feature), SQON op rename `filter`->`wildcard` on the _write_ side only (schema still accepts
  both, so read-compatible both directions), and the one real breaking change: exported
  `SQONType` swapped from `sqon-builder`'s `SQON` type to the absorbed package's `SqonNode` type,
  a structurally different (wider) union. Judged low real-world exposure after checking actual
  consumers (see below) and bumped as a minor, not major.
- `charts`: new `NetworkNodesChart` component (additive), plus breaking changes to the exported
  `useChartsContext` extensibility point: `deregisterChart`'s parameter shape changed, and
  `getChartData`'s return shape changed from a flat `{isLoading, isError, data}` object to a
  discriminated union. Pre-1.0, no prior stable release, so this just incremented the rc counter.
- `mcp-server`: brand new `execute-query` MCP tool (query builder, query validator, result
  flattener, structured error formatting), substantially more capability than the 0.1.0-rc.1
  baseline. No prior stable release, so rc counter increment only.
- `search-server`: config wiring for the new `types` flags plus the network feature (a config
  template that was already stale/non-functional got corrected), the same `DISABLE_SETS`->
  `ENABLE_SETS` breaking rename as `types` (flagged for release notes; judged low-risk since the
  Sets feature had negligible real usage). No prior stable release under this app's current
  structure, so rc counter increment only.

**Real-world exposure check that informed the `components` severity call:** grepped this
machine for other repos depending on `sqon-builder` (the package `components` is moving away
from). Found three: one abandoned/dead project, one active repo confirmed to not interact with
`arranger-components` at all, and one repo the user owns directly and can update on their own
schedule. This concretely narrowed the realistic blast radius of the `SQONType` breaking change,
which is what justified `3.1.0-rc.1` over the semver-textbook-correct-but-more-cautious
`4.0.0-rc.1`. This is exactly the kind of judgement a fully automated severity tool (§7) could
never make: it requires knowing who actually consumes the package outside the repo.

**Final bump applied:**

```
sqon: 1.0.0-rc.1 -> 1.0.0-rc.2
types: 1.0.0-rc.2 -> 1.0.0-rc.3
graphql-router: 1.0.0-rc.3 -> 1.0.0-rc.4
components: 3.0.8-rc.2 -> 3.1.0-rc.1
charts: 0.1.0-rc.1 -> 0.1.0-rc.2
mcp-server: 0.1.0-rc.1 -> 0.1.0-rc.2
search-server: 3.1.0-rc.1 -> 3.1.0-rc.2
```

Resulting commits on `release-test` (unpushed as of this writing, left for the user to review
and push): `Merge branch 'main' into release-test`, then `version bumps for all` with the above
list in the commit body.

---

## 9. Open questions to resolve when abstracting this into an agentics convention

- Does every monorepo adopting this pattern need the `main` = `0.0.0-dev` placeholder
  convention, or is that specific to repos where Jenkins reads the version field directly rather
  than deriving it from Changesets/git tags?
- The rc-counter-vs-real-severity distinction in §5 assumes a codebase with a mix of
  never-released and already-released packages. A brand-new monorepo (everything pre-1.0,
  nothing shipped) or a fully-mature one (everything has real releases) simplifies to one branch
  of that rule uniformly; worth stating both simplified forms explicitly in the convention,
  rather than only the mixed case.
- Whether the "two separate commits" convention (merge, then bump) is worth mandating generally,
  or whether it's only valuable at this repo's current PR-review granularity. Squash-merge-heavy
  teams might not get the same benefit from it.
- The `package-lock.json` "always regenerate, never hand-merge" rule generalizes to any
  npm-based monorepo; the equivalent for other package managers (`pnpm-lock.yaml`, `yarn.lock`)
  should be stated as the general principle ("never hand-resolve a generated lockfile's conflict
  markers; keep one side, then regenerate") rather than npm-specific.
- Whether the CI severity-suggestion enhancement (§7) belongs in the convention itself as a
  recommended pairing with Changesets, or as a separate, optional convention.
