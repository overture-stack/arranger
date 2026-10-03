# Arranger auth

Access control for Arranger: the enforcement seam, the Usher PEP adapter, and everything gated on them. Created when this stopped fitting in a single file.

## Read in this order

| File | What it holds |
|---|---|
| [`design.md`](design.md) | The core decision, enforcement belongs at the query-building boundary rather than the transport boundary, and why. Current state of `getServerSideFilter` and its three weaknesses. Per-catalogue scoping. Global-versus-per-catalogue composition. Platform admin bypass. Client-side. |
| [`roadmap.md`](roadmap.md) | Sequencing, Phase 0 through 3, with the rationale for the order (by what silently breaks if skipped, not by value). |
| [`debt.md`](debt.md) | Scoped index of `.dev/tech-debt.md` entries on an access-control path, with why each matters here. Two are blocking. |
| [`auth-mode-changes.md`](auth-mode-changes.md) | Register of behaviour that differs between an Arranger with no access control and one running the Usher adapter. Defaults that are correct while nothing needs protecting and wrong once something does, so it reads as a checklist for enabling auth rather than a defect list. |
| [`usher-adapter.md`](usher-adapter.md) | The Usher-specific half, and the longest file here. Design: terminology mapping, grants payload shape, translation algorithm, the confirmed integration point (a callback factory, not middleware), the two-layer contract, mock-first approach. Plus what the Phase 0 audit changed about the Usher adapter's own design, the cross-service current-state findings, and the question sets driving the iMS exchange. **Start at its status table** under "Current-state questions" to see what is answered and what is still open. |
| [`usher-adapter-tests.md`](usher-adapter-tests.md) | The step 1 test plan, for review: the adapter's surface traced through one request, the fake bridge, fixtures written as enforcement results, and the suites with what each asserts. |

Which layer each piece of this lives in, and what each layer calls the filter, is in [atlas: Arranger's layers and their vocabulary](../atlas/layers-and-vocabulary.md).

## The short version

Enforcement is Arranger's, application of the bridge's result is the Usher adapter's. The bridge renders each catalogue's enforcement result from the grants token, the Usher adapter hands it to Arranger's seam as SQON, and it knows nothing about guaranteeing it gets applied; Arranger owns a seam that guarantees any additional filter reaches every read path. That split is what lets the planned Beacon and REST transports inherit enforcement instead of each reimplementing it.

Two things must be fixed before enforcement is built on the current seam, both of them defects today rather than Usher work: there is no structured logging for denial or bypass events to land in, and a wrong or missing `nestedFieldNames` entry silently fails open on a negated enforcement clause (confirmed concrete against the Usher adapter's own complement encoding). See [`debt.md`](debt.md).

## Relationship to the canonical working documents

`.dev/roadmap.md` and `.dev/tech-debt.md` remain canonical and are what the session-start checklist reads. The `roadmap.md` and `debt.md` files here are **scoped views**: they order and annotate auth-relevant work, cross-linking canonical entries rather than duplicating them. New planned work goes in `.dev/roadmap.md`; new defects go in `.dev/tech-debt.md`; both get indexed here. This is deliberate, a subsystem-local copy of either would be invisible to the session-start routine and would drift.

## Cross-repo

Usher's own design documents live in the Usher repo under `.dev/design/`: `adapter-integration.md` (the generic Usher adapter contract, enforcement result to native filter), `decisions.md`, `security-workflow.md` (grants token format and the three-tier grant pipeline), `permissions-model.md`, `admin-model.md`. Usher deliberately has no notion of catalogues; "catalogue" is Arranger vocabulary with no Usher-model equivalent, and the catalogue binding lives entirely in this Usher adapter's config.
