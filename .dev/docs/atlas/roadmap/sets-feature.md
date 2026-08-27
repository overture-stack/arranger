# Sets: full feature implementation

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entry. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Sets: full feature implementation

_Priority: active. Backend exists but the feature is incomplete._

**Framing, from the developer 2026-08-25: under-developed rather than abandoned, and to be prioritized later.** Earlier notes here and in the auth subsystem read the sparse surface as neglect and reasoned toward removal. That is the wrong starting point: the feature is unfinished rather than dead, so proposals should assume it will be built out rather than retired.

**There is at least one real consumer, and Arranger's documentation did not know about it.** Downloads carry set IDs to Singularity, which uses them to query the search engine directly. Reported by the developer and recorded in [`sets-consumer-singularity.md`](../../sets-consumer-singularity.md), scoped to portal-ui's clinical download path; its environmental path builds downloads in the browser and touches neither sets nor Singularity. Two things follow immediately. `Singularity` appears nowhere in this repository, so an integration exists that nobody working on sets here could see. And a consumer that reaches the search engine directly is outside every enforcement path Arranger has, which makes the question of whether it replays a set's materialized `ids` or re-runs its stored `sqon` load-bearing rather than academic: the first is a fixed document list that outlives any change to the index, the second is re-evaluated on use.

Sets are saved groupings of documents from a catalog; think "save this search result for later" or "share this selection with a colleague." Confirmed backend inventory: exactly **one** operation exists end-to-end. `saveSet` (type def `modules/graphql-router/src/schema/Root.ts:68`, resolver `mapping/resolveSets.js:58-108`) runs a SQON as an ES query, walks every matching document via `search_after` pagination, and indexes a static snapshot (`{setId, createdAt, ids, type, path, sqon, userId, size}`, mapping in `schema/index.ts:11-20`) into a dedicated sets index. There is no `listSets`, `deleteSet`, `updateSet`, or `renameSet` anywhere in the codebase.

**Corrected 2026-08-25: there *is* a query path, and this entry previously said there was not.** `createSetsType` (`schema/index.ts:28`) builds the sets index as a pseudo-catalogue and passes it through `createConnectionResolvers` alongside the real document type (`schema/Root.ts:160-171`), so the schema exposes a full `sets` connection with both `hits` and `aggregations`, over the same fields the mapping declares (`setId`, `userId`, `ids`, `sqon`, `type`, `path`, `size`, `createdAt`). So the surface is wider than "write-only" and wider than anyone designing the feature from this document would expect. Its access-control behaviour is tracked separately in `.dev/tech-debt.md` and in [`arranger-auth/debt.md`](../../arranger-auth/debt.md); the point here is only that the query surface exists.

What is genuinely absent is a *managed* read path: no named operation, no ownership scoping, and nothing a UI could build on without querying the sets index as though it were a catalogue. UI-side, the only artifact is `modules/components/src/utils/saveSet.js`, a thin mutation wrapper consumed inside `Arranger/MatchBox.jsx:265-289`; there is no create/view/manage/share panel of any kind.

The full scope includes:

- **Backend:** `saveSet` (create) exists; `listSets`, `deleteSet`, and `updateSet` are entirely missing, not partially built. Error handling on the existing path is unverified, since it has no test coverage (see [tech-debt: no unit tests for `resolveSetsInSqon`](tech-debt.md#no-unit-tests-for-resolvesetsinsqon-set-expansion)).
- **UI:** Components for creating, viewing, managing, and sharing sets, integrated with the existing filter/search UI. Zero UI exists beyond the MatchBox save affordance.
- **Access control:** Sets should support Attribute-Based Access Control (ABAC). A set has an owner; it can be private, shared with specific users, or public. This design needs to be done before the backend is completed, as it affects the data model. Confirmed: the sets ES mapping stores `userId` per set today, but nothing anywhere reads or enforces it, and the query-time resolution path (`set_id:` filter expansion) is not even gated by `ENABLE_SETS`, only index creation is (see [tech-debt: `ENABLE_SETS` flag does not fully gate the Sets query path](tech-debt.md#enable_sets-flag-does-not-fully-gate-the-sets-query-path)). This is a live gap, not only a forward-looking design question.
- **Virtual cohorts:** Rather than storing a static list of document IDs, a set can be defined as a saved filter/query that resolves dynamically at query time. Confirmed: today's `ids` field is a frozen snapshot taken at creation time; the `sqon` is stored alongside it but never re-run. Virtual cohorts would be a genuinely new resolution mode, not an extension of the existing one.

This is a substantial multi-sprint effort. Backend and UI work can be parallelized once the ABAC model is defined. The `ENABLE_SETS` feature flag exists precisely because this is a work in progress; it should remain until the feature is complete and stable.
