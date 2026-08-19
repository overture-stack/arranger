# Sets: full feature implementation

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entry. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Sets: full feature implementation

_Priority: active. Backend exists but the feature is incomplete._

Sets are saved groupings of documents from a catalog; think "save this search result for later" or "share this selection with a colleague." Confirmed backend inventory: exactly **one** operation exists end-to-end. `saveSet` (type def `modules/graphql-router/src/schema/Root.ts:68`, resolver `mapping/resolveSets.js:58-108`) runs a SQON as an ES query, walks every matching document via `search_after` pagination, and indexes a static snapshot (`{setId, createdAt, ids, type, path, sqon, userId, size}`, mapping in `schema/index.ts:11-20`) into a dedicated sets index. There is no `listSets`, `deleteSet`, `updateSet`, or `renameSet` anywhere in the codebase, and no query to fetch a set back: a user can create a set and never see, rename, or delete it again through the API. UI-side, the only artifact is `modules/components/src/utils/saveSet.js`, a thin mutation wrapper consumed inside `Arranger/MatchBox.jsx:265-289`; there is no create/view/manage/share panel of any kind.

The full scope includes:

- **Backend:** `saveSet` (create) exists; `listSets`, `deleteSet`, and `updateSet` are entirely missing, not partially built. Error handling on the existing path is unverified, since it has no test coverage (see [tech-debt: no unit tests for `resolveSetsInSqon`](tech-debt.md#no-unit-tests-for-resolvesetsinsqon-set-expansion)).
- **UI:** Components for creating, viewing, managing, and sharing sets, integrated with the existing filter/search UI. Zero UI exists beyond the MatchBox save affordance.
- **Access control:** Sets should support Attribute-Based Access Control (ABAC). A set has an owner; it can be private, shared with specific users, or public. This design needs to be done before the backend is completed, as it affects the data model. Confirmed: the sets ES mapping stores `userId` per set today, but nothing anywhere reads or enforces it, and the query-time resolution path (`set_id:` filter expansion) is not even gated by `ENABLE_SETS`, only index creation is (see [tech-debt: `ENABLE_SETS` flag does not fully gate the Sets query path](tech-debt.md#enable_sets-flag-does-not-fully-gate-the-sets-query-path)). This is a live gap, not only a forward-looking design question.
- **Virtual cohorts:** Rather than storing a static list of document IDs, a set can be defined as a saved filter/query that resolves dynamically at query time. Confirmed: today's `ids` field is a frozen snapshot taken at creation time; the `sqon` is stored alongside it but never re-run. Virtual cohorts would be a genuinely new resolution mode, not an extension of the existing one.

This is a substantial multi-sprint effort. Backend and UI work can be parallelized once the ABAC model is defined. The `ENABLE_SETS` feature flag exists precisely because this is a work in progress; it should remain until the feature is complete and stable.
