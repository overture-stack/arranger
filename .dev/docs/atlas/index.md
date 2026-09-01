# Atlas index

- [Lyric pluralization bug: empty nested-entity aggregations](lyric-maestro-indexing-gap.md): confirmed root cause for donor-catalogue nested facets/aggregations returning empty buckets against the dev cluster; a Lyric pluralization bug (since fixed there), not an Arranger query-building bug; the ES mapping's own nesting depth is a separate, still-open item
- [pnpm migration: scoping findings](pnpm-migration.md): supports roadmap §3.3; workspace-config location, publish-time sibling-version rewrite mechanics, the new default-blocked dependency install scripts risk, a completed and fixed phantom-dependency audit (including a real `query-string` ESM/CJS version-compatibility catch), `ts-patch` confirmed pnpm-compatible via prototype, `wireit` left unprototyped per developer confidence
- [Monorepo review: 2026-08-17](monorepo-review-2026-08-17.md): full requested review across all packages via 8 parallel agents; ~50 findings now in `tech-debt.md`, this doc is the severity-ranked triage entry point plus the cross-cutting patterns found (repeated `apiUrl`-forwarding gap, typed-JS-component-with-no-TS-interface, drifted hand-maintained lookup tables, an unwired feature flag, six stale tech-debt/roadmap entries corrected)
- [Monorepo review, second pass: 2026-08-17](monorepo-review-2026-08-17-second-pass.md): same day, deliberately different lenses (link integrity, repo infrastructure, dependency health, cross-workspace config drift, the roadmap as an artifact, error/logging conventions, public API surface, test strategy). Carries the `/download` seven-defect cluster, the confirmed pnpm blocker in `modules/charts`, the first-ever `npm audit` baseline, and reference tables that exist nowhere else (testing-layer map, public-export inventory, cross-workspace config comparison)
- [Arranger's layers and their vocabulary](layers-and-vocabulary.md): which layer owns what from SQON up to the server, what each layer calls the same filter (`matchEverything`, the constraint, the server-side filter), the dependency direction that keeps Arranger running without Usher, and the planned moves that make the code match

## Roadmap detail layer

Added under `roadmap_split: yes`. `.dev/roadmap.md` carries what each item is and where it stands; these files hold the justification, alternatives considered, prior art, and history.

Applied per the convention's per-entry content test (does this entry carry reasoning beyond what-it-is-and-where-it-stands?), swept across every entry rather than ranked by density. Of 73 entries: 24 had reasoning extracted, 2 resolved items were removed outright per the working-docs convention, and the rest were already conformant. Verified afterwards that no entry still carries reasoning. Grouped by topic rather than one file per entry, so a cohesive area reads as one document.

- [MCP integration readiness](roadmap/mcp-integration-readiness.md)
- [GA4GH Beacon v2 module](roadmap/ga4gh-beacon-v2.md)
- [Multicatalogue catalogue lifecycle](roadmap/multicatalogue-lifecycle.md)
- [Changesets adoption](roadmap/changesets-adoption.md)
- [Configuration tooling and layering](roadmap/config-tooling.md): plan/preview CLI, config separation, per-catalogue credentials
- [OpenSearch-first migration](roadmap/opensearch-migration.md)
- [Auth, ABAC, and the admin access model](roadmap/auth-and-access-control.md)
- [Query economics](roadmap/query-economics.md): persisted queries, PIT pagination, complexity limits
- [Observability](roadmap/observability.md): metrics, tracing, per-catalogue availability
- [Structured logging: the event envelope](roadmap/structured-logging.md): the settled CloudEvents decisions, the rejected service segment, and the `source` convention and shared entity vocabulary the shape still owes
- [Planned SQON operators](roadmap/sqon-operators.md): fuzzy, genomic interval overlap, hybrid vector search
- [Portable SQON encoding for URLs and citations](roadmap/sqon-portability.md): measurements for both regimes, prior art, four open questions
- [Sets: full feature implementation](roadmap/sets-feature.md)
- [modules/components modernization](roadmap/components-modernization.md): legacy patterns, theming, Emotion replacement, Storybook
- [Decoupling the startup health check](roadmap/health-check-credential.md)

Two files predate this convention and are the same pattern under different names: `pnpm-migration.md` (roadmap §3.3) and `nesting-prefix.md`, which now also carries the resolved feature's implementation record.

## Consumer integrations

- [Sets consumer: portal-ui and Singularity](../sets-consumer-singularity.md): a real dependency on Arranger's sets feature that this repository had no record of. Reported and verified with file references by the portal-ui owner. Scoped to the **clinical** download path: portal-ui's environmental path builds its download in the browser from a plain Arranger query and touches neither sets nor Singularity. Carries the structural finding that **Arranger is not the only reader of the `clinical_centric` data index**, since Singularity reads that one directly with its own credentials, and one deliberately open question about whether a set's materialized `ids` or its stored `sqon` is what gets used.

## Subsystem docs

- [Arranger auth](../arranger-auth/index.md): access control. The enforcement-seam design (query-building boundary, not transport boundary), auth-work sequencing, a scoped index of access-control-path defects, and the Usher PEP adapter. Includes `auth-mode-changes.md`, the register of what behaves differently once access control is on.

## Proposals, plans, and postmortems

- [A first-class value-widening primitive for `SqonBuilder`](../sqon-widening-primitive.md): design proposal, drafted for adversarial review before any code, following the process `matchNothing()` went through. One review round complete; `not`'s compilation semantics were wrong in the first draft and are corrected throughout. Not implemented.
- [MCP server platform testing](../mcp-platform-testing.md): plan for a fixed harness, fixed dataset, and pinned model configuration run against a changing `apps/mcp-server`, so a keep-or-revert decision has numbers behind it. Plan only, nothing implemented.
- [Postmortem: `sqon`'s `generateVersion.mjs` self-triggering rebuild loop](../watch-loop-from-sqon-generateVersion.md): the incident in full, plus source material for a general convention. Carries a note on what to generalize when it is decanted into agentics.

## Subsystem and process references

- [Search engine integration](../search-engine-integration.md): how Arranger talks to OpenSearch and Elasticsearch. Supported engines, client creation, startup sequence, query execution, downloads, Sets operations, and the transport-action permission behind each, with OpenSearch's published action list as the verifiable source for both engines.
- [Arranger release process](../release-process.md): `main` through release-candidate tags to a real npm and Docker release, in full. Written to be abstracted later into a general monorepo rc-then-release convention.
- [Components: multicatalogue support](../components-multicatalogue.md): design notes for extending `modules/components` and `modules/charts` to Arranger's `/{catalogueId}/graphql` routing, backward-compatibly with single-catalogue usage.
- [`build_sqon` MCP tool: design](../build-sqon-tool.md): why the tool exists, what it does, which drafts were rejected, and the rationale for each resolved choice. MCP and LLM layers only.
- [`build_sqon` implementation plan](../build-sqon-implementation.md): the build half of the pair above. File layout, worked code, checks, tests, and the text surfaces that change when it ships. Disagreements with the design document are called out inline.
- [`nestingPrefix`](../nesting-prefix.md): named above under the roadmap detail layer, and linked here so a count of this index reaches it.

**Completeness here needs a count, not a read, and the count needs a definition of "indexed".** Nine files were reachable only by listing the directory. A sweep starting from either list, this index or the roadmap, cannot find a file neither list holds.

Two judgment inputs decide whether that count is meaningful, and both fail quietly. **Scope:** counting `roadmap/` alone returns fourteen of fourteen and looks clean, because the missing files were one tier up. **What counts as reachable:** treating any mention anywhere as reachability found three of the nine, since an incidental reference from a tech-debt entry is not an index entry, and a reader browsing this file still cannot get there. A wrong definition returns a plausible number rather than an error.

The second input is sharper than "what you accept as an index". It is **whether you know every mechanism by which a file can be reachable**, and a definition can fail in either direction. Too permissive hides orphans, as above. Too narrow invents them: checking the published tree for prose links alone would have reported two pages as unreachable that are listed by a generated index, a mechanism a link-following check has no reason to look for. Only one of those two errors is self-correcting, and it is the one that looks worse: a false orphan demands an action and gets caught, while a false clean result asks nothing of anyone and closes the question.

Two other shapes are worth distinguishing from this one. A pointer that outlives what it points at reads as a live entry leading nowhere, and is caught by following every pointer. A target that outlives its pointer is findable only by `ls`, and is caught by sweeping whichever half the working conventions do not already make someone touch.

**None of this applies to the published `docs/` tree, and the reason is the useful part.** Its navigation is derived rather than maintained: `docs/reference/reference.mdx` lists its siblings through Docusaurus' `<DocCardList />`, and page order comes from `sidebar_position` front matter and the filenames themselves. A generated index cannot drift from what it indexes, so all four failure modes are structurally absent there. This file is hand-maintained and therefore needs the count. Worth knowing before anyone proposes hand-writing an index for `docs/`, which would replace a list that cannot go stale with one that can.
