# Changesets adoption (roadmap §3.1)

Detail layer for the [`3.1 Adopt Changesets for versioning and changelog automation`](../../../roadmap.md) roadmap entry. The roadmap carries the terse summary and current status; this file holds the reasoning, alternatives considered, prior art, and history. Split out 2026-08-18 under `roadmap_split: yes`.

---

**Sequencing: depends on §3.3 (pnpm) landing first, despite the numbering.** Changesets' internal-dependency cascade-bump detection is built around `workspace:` or real-semver references, not `file:`; adopting this before §3.3 would leave it nothing sensible to cascade against for any sibling dependency in the repo. See §3.3's own note and [atlas: pnpm migration scoping findings](docs/atlas/pnpm-migration.md).

Replaces manual version bumping + Jenkins git tagging. Packages version **independently**.

```bash
npm install --save-dev @changesets/cli
npx changeset init
```

Configure `.changeset/config.json`:

```json
{
	"changelog": "@changesets/cli/changelog",
	"commit": false,
	"linked": [],
	"access": "public",
	"baseBranch": "main",
	"updateInternalDependencies": "patch",
	"ignore": [
		"@overture-stack/arranger-search-server",
		"@overture-stack/arranger-mcp-server",
		"integration-tests-import",
		"integration-tests-search-server",
		"integration-tests-mcp-server"
	]
}
```

`integration-tests-mcp-server` added 2026-08-17: `integration-tests/mcp-server` is `"private": true` exactly like its two listed siblings, and was missing from this worked example.

**Corrected later the same day:** the list also carried `integration-tests-server`, which is not a real package name; `integration-tests/server`'s `package.json` declares `integration-tests-search-server`. Changesets matches on package name, so that entry would have silently ignored nothing and treated the ES-dependent private package as publishable. Worth noting how it survived: the 2026-08-17 pass above audited this list and added a missing entry without verifying the entries already in it. Also check §2.2's `--filter=!integration-tests/server` against the same mismatch before that phase lands.

New workflow: PR authors run `npx changeset` to declare which packages changed and at what semver level. On `release` branch, replace Jenkins Stage 4 + Stage 6 with:

```groovy
sh "npx changeset publish"
```

**Enhancement worth layering on top:** a CI check that diffs each package's exported API surface (e.g. against its `index.ts`/`.d.ts`, or via a tool like `api-extractor`) relative to the last published version, and posts a suggested severity (patch/minor/major) as a PR comment or pre-fills the `changeset` prompt. This doesn't replace the author's judgement (breaking-vs-additive calls are too fuzzy to fully automate reliably; manually reconstructing this for 7 packages during an rc round confirmed that), but it gives them a concrete starting point instead of deriving severity from scratch.

**What Changesets actually does here** (corrected 2026-08-17; this paragraph previously claimed `changeset version` rewrites `file:` deps to real version ranges, which §3.3 already recorded as false but was never fixed at the source): Changesets owns version-bump decisions, changelog generation, publishing in dependency order, and `updateInternalDependencies`' cascading-bump detection. It does **not** rewrite how a sibling dependency is referenced. The `file:`/`workspace:` substitution happens exclusively in pnpm's publish step, so removing `scripts/fix-workspace-deps.mjs` and its Jenkins `git checkout` lines belongs to §3.3's cleanup, not this one. `scripts/verify-pack.mjs` (`npm run release:check`) stays as a belt-and-suspenders gate either way.
