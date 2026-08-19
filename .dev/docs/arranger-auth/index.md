# Arranger auth

Access control for Arranger: the enforcement seam, the Usher PEP plugin, and everything gated on them. Created 2026-08-18 when this stopped fitting in a single `usher-plugin.md`.

## Read in this order

| File | What it holds |
|---|---|
| [`design.md`](design.md) | The core decision, enforcement belongs at the query-building boundary rather than the transport boundary, and why. Current state of `getServerSideFilter` and its three weaknesses. Per-catalogue scoping. Global-versus-per-catalogue composition. Platform admin bypass. Client-side. |
| [`roadmap.md`](roadmap.md) | Sequencing, Phase 0 through 3, with the rationale for the order (by what silently breaks if skipped, not by value). |
| [`debt.md`](debt.md) | Scoped index of `.dev/tech-debt.md` entries on an access-control path, with why each matters here. Three are blocking. |
| [`phase-0-audit.md`](phase-0-audit.md) | A deliberate sweep for silent enforcement gaps, five lenses, execution-preferred. Defines what qualifies as Phase 0 and why reading code is insufficient here. |
| [`usher-plugin.md`](usher-plugin.md) | The Usher-specific half, and the longest file here. Design: terminology mapping, grants payload shape, translation algorithm, the confirmed integration point (a callback factory, not middleware), the two-layer contract, mock-first approach. Plus what the Phase 0 audit changed about the plugin's own design, the cross-service current-state findings, and the question sets driving the iMS exchange. **Start at its status table** under "Current-state questions" to see what is answered and what is still open. |

## The short version

Enforcement is Arranger's, translation is the plugin's. `usher-arranger` turns a GrantsPayload into SQON and knows nothing about guaranteeing it gets applied; Arranger owns a seam that guarantees any additional filter reaches every read path. That split is what lets the planned Beacon and REST transports inherit enforcement instead of each reimplementing it.

Three things must be fixed before enforcement is built on the current seam, all of which are defects today rather than Usher work: the export path bypasses server-side filters entirely, two aggregation filter mechanisms disagree on AND versus OR with one dead at real-world nesting depth, and there is no structured logging for denial or bypass events to land in. See [`debt.md`](debt.md).

## Relationship to the canonical working documents

`.dev/roadmap.md` and `.dev/tech-debt.md` remain canonical and are what the session-start checklist reads. The `roadmap.md` and `debt.md` files here are **scoped views**: they order and annotate auth-relevant work, cross-linking canonical entries rather than duplicating them. New planned work goes in `.dev/roadmap.md`; new defects go in `.dev/tech-debt.md`; both get indexed here. This is deliberate, a subsystem-local copy of either would be invisible to the session-start routine and would drift.

## Cross-repo

Usher's own design documents live in the Usher repo under `.dev/design/`: `plugin-integration.md` (the generic plugin contract, GrantsPayload to native filter), `decisions.md`, `security-workflow.md` (grants token format and the three-tier grant pipeline), `permissions-model.md`, `admin-model.md`. Usher deliberately has no notion of catalogues; "catalogue" is Arranger vocabulary with no Usher-model equivalent, and the catalogue binding lives entirely in this plugin's config.
