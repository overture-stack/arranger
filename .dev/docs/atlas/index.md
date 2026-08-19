# Atlas index

- [Lyric pluralization bug: empty nested-entity aggregations](lyric-maestro-indexing-gap.md): confirmed root cause for donor-catalogue nested facets/aggregations returning empty buckets against the dev cluster; a Lyric pluralization bug (since fixed there), not an Arranger query-building bug; the ES mapping's own nesting depth is a separate, still-open item
- [pnpm migration: scoping findings](pnpm-migration.md): supports roadmap §3.3; workspace-config location, publish-time sibling-version rewrite mechanics, the new default-blocked dependency install scripts risk, a completed and fixed phantom-dependency audit (including a real `query-string` ESM/CJS version-compatibility catch), `ts-patch` confirmed pnpm-compatible via prototype, `wireit` left unprototyped per developer confidence
- [Monorepo review: 2026-08-17](monorepo-review-2026-08-17.md): full requested review across all packages via 8 parallel agents; ~50 findings now in `tech-debt.md`, this doc is the severity-ranked triage entry point plus the cross-cutting patterns found (repeated `apiUrl`-forwarding gap, typed-JS-component-with-no-TS-interface, drifted hand-maintained lookup tables, an unwired feature flag, six stale tech-debt/roadmap entries corrected)
- [Monorepo review, second pass: 2026-08-17](monorepo-review-2026-08-17-second-pass.md): same day, deliberately different lenses (link integrity, repo infrastructure, dependency health, cross-workspace config drift, the roadmap as an artifact, error/logging conventions, public API surface, test strategy). Carries the `/download` seven-defect cluster, the confirmed pnpm blocker in `modules/charts`, the first-ever `npm audit` baseline, and reference tables that exist nowhere else (testing-layer map, public-export inventory, cross-workspace config comparison)

## Roadmap detail layer

Added 2026-08-18 under `roadmap_split: yes`, completed the same day. `.dev/roadmap.md` carries what each item is and where it stands; these files hold the justification, alternatives considered, prior art, and history.

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
- [Planned SQON operators](roadmap/sqon-operators.md): fuzzy, genomic interval overlap, hybrid vector search
- [Sets: full feature implementation](roadmap/sets-feature.md)
- [modules/components modernization](roadmap/components-modernization.md): legacy patterns, theming, Emotion replacement, Storybook
- [Decoupling the startup health check](roadmap/health-check-credential.md)

Two files predate this convention and are the same pattern under different names: `pnpm-migration.md` (roadmap §3.3) and `nesting-prefix.md`, which now also carries the resolved feature's implementation record.

## Subsystem docs

- [Arranger auth](../arranger-auth/index.md): access control. The enforcement-seam design (query-building boundary, not transport boundary), auth-work sequencing, a scoped index of access-control-path defects, and the Usher PEP plugin. Absorbed the former `.dev/docs/usher-plugin.md`.
