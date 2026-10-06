# Usher adapter tests: the step 1 plan

**Status: a draft for review from both sides.** In Usher's build order, step 1 is this adapter: its
tests come first, written from Usher's side and reviewed from Arranger's until they are ready to
code against. The adapter is then implemented from Arranger's side. This file is the plan for those
tests. It is roadmap item 10 tested the way item 12 asks, against a mocked bridge and controller.

Two rules from the build order apply throughout. **The consumer's tests decide the interface's
shape, and the case table decides its answers.** The cases are the numbered ones in Usher's
`.dev/design/token-calculation.md`.

---

## What these tests cover, and what they leave to others

| Concern                                                                  | Where it is tested                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| The adapter's public surface and its failure cases                       | here                                                  |
| What each enforcement result does to records, counts, facets and exports | here                                                  |
| The startup checks on a catalogue's mapping                              | here, with the data-value check waiting on Usher      |
| The log events' presence and shape                                       | here, with their logic filled in once filtering works |
| How the bridge renders a payload into a result                           | step 2, the bridge's own tests                        |
| Telling a denial apart from an empty result                              | roadmap item 5, which widens the seam                 |
| Saved sets                                                               | roadmap item 8                                        |
| Federation                                                               | after the federation posture decision                 |
| The platform admin bypass                                                | roadmap item 11                                       |

---

## One request, traced

The case table's principal, Ana, has accepted a grant on HEART_STUDY's `controlled` records, made
to a group she belongs to (case 5). The baseline is on, so she also holds `unmarked` everywhere it
is open. She queries the synthetic catalogue described under the fixtures below.

1. At startup, with access control on, the search-server image constructs the bridge and passes it
   to the adapter's factory, with the field names and category mapping for each catalogue it serves.
2. The adapter registers each catalogue's field names and mapping with the bridge, and returns one
   `getServerSideFilter` callback per catalogue. The image passes each to its own catalogue's GraphQL
   router, so a callback serves one catalogue and never learns which one from the request.
3. Each GraphQL router fetches its index mapping as it does today, and exposes the mapping it
   resolved.
4. The adapter verifies each catalogue against that resolved mapping, before the image starts
   listening, and registers it with the bridge: its field names, the value each concrete category
   maps to, and the categories it declares absent. The image then awaits the bridge's start, which
   fetches the anonymous payload and runs the category-gap check for the open tier, and only then
   listens. A callback whose catalogue has not been verified throws, so a host that skips the check
   fails closed, and loudly. What a catalogue failing the check does is in the startup suite below.
5. A request arrives. The bridge's middleware, mounted ahead of the GraphQL routers, resolves Ana's
   token and attaches the request's access to Express's per-request store under `usher`: her
   subject, and one enforcement result per catalogue.
6. The GraphQL router carries that store to the callback on every read path: hits, aggregations,
   saving a set, and exports.
7. The callback finds this catalogue's result, `narrow`, returns its filter unchanged, and logs that
   it applied it.
8. Arranger's guard checks the filter as received, and composes it with the client's filter.
9. Ana sees HEART_STUDY's `controlled` and `unmarked` records, and the `unmarked` records of the
   other two studies. Nothing else, on any endpoint.

**Three of these steps need changes outside the adapter**, made with it, and each is additive, so a
deployment without access control sees no difference:

| Step | Today                                                             | The change                                                                                                        |
| ---- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2    | the image takes one filter callback for every catalogue           | with access control on, the image passes each catalogue its own callback                                          |
| 3    | the GraphQL router keeps the mapping it fetched to itself         | it exposes the resolved mapping                                                                                   |
| 6    | every read path receives `req.context`, a store of Arranger's own | the store becomes Express's own `res.locals`, with `req.context` a deprecated view kept for existing integrations |

**The plan targets the search-server image**, since that is what the first deployment runs. The
factory stays usable by a custom host that builds a GraphQL router per catalogue, which is the shape
the suites through the GraphQL router below use directly.

**With access control on, the image bounds exports by default.** Where `ENABLE_ACCESS_CONTROL=true`
and `DOWNLOAD_MAX_ROWS` is unset, an export stops at 100 rows; without access control, an unset
limit means no limit, as in 3.0. An explicit value applies either way, `0` meaning every row, and an
export cut short by a limit says so. The router knows nothing of this: the image chooses its own
default from its own flag, and a custom host using the adapter sets its limit itself. The startup
suite checks the default, and the suites through the GraphQL router check that a cut export carries
its marker.

The adapter decides nothing in this trace: it reads a result and applies it. That is the property
the tests hold it to, because the bridge builds every predicate.

---

## What the tests import

**The enforcement result and the bridge's interface come from `@overture-stack/usher-types`.**
That package is created once Arranger's TypeScript, zod and pnpm upgrades are settled, and the tests
can be written before then. Until it exists they import a stand-in module in the adapter's test
directory, copied from the types in Usher's `decisions.md` and deleted in the commit that links the
package. The stand-in exports only what the package will, so the switch is an import path.

    type Enforcement =
      | { kind: 'deny';   reason: 'no-grants' | 'unknown-resource' }
      | { kind: 'narrow'; sqon: SqonNode }
      | { kind: 'allow' }

**The request's access arrives as one value, `UsherRequestAccess`**, read only through `readAccess`
from `@overture-stack/usher-types`, never by its key, `usher`. `readAccess` throws when the value is
missing, invalid or of an unknown version, which is what the failure cases below exercise. Which
per-request store carries it changes only the host's wiring, never a test of the adapter. See
Usher's `adapter-integration.md` for the value and why each bridge uses its framework's own store.

---

## The fake bridge

The fake bridge is the adapter's only stand-in for Usher, and it follows the build order's rules for
mocks.

- **It holds a fixed, hand-written set of results and refuses anything outside it.** An unregistered
  catalogue or an unknown principal throws. A mock that answers whatever it is asked lets the
  adapter define the contract by its own appetite.
- **It implements the bridge's interface type**, so a fake that drifts from the real bridge stops
  compiling.
- **Its middleware attaches the request's access with `attachAccess`, as the real one will**, and it
  has two degraded modes, both the bridge's own behaviour: uncertain, past its grace period, which
  attaches the open tier alone, marked open-tier only, with each signed-in principal marked
  suspended; and cold, never having reached the controller, which answers 503 before any GraphQL
  router runs.
- **It records each catalogue's registration**: the field names, each concrete category's mapped
  value, and the categories declared absent, all used by the real bridge to check each resource's
  offered categories against.

**A recording search client** wraps the engine client's `search`, so the `deny` rows can assert the
query the GraphQL router emits as well as the records it returns.

---

## The fixtures are enforcement results, not payloads

The adapter never receives a payload, so its fixtures are what the bridge would hand it. Each row
traces to a case, and the same rows become the bridge's expectations in step 2: given that case's
entry in `principals.json` and this catalogue's mapping, the bridge must render exactly this result.
The adapter's fixtures and the bridge's expected outputs are then one table, read from both ends.

**The synthetic catalogue** follows the case table's configuration: HEART_STUDY carries
`controlled`, LUNG_COHORT carries no concrete category, and REEF_ARCHIVE carries `controlled` and
`community-governed`. Its resource field and its category field are flat keywords.

| Record | Resource           | Category             | Why it is here                                     |
| ------ | ------------------ | -------------------- | -------------------------------------------------- |
| h1     | HEART_STUDY        | `controlled`         | reached only through a grant                       |
| h2     | HEART_STUDY        | none                 | `unmarked`                                         |
| l1     | LUNG_COHORT        | none                 | `unmarked` on a resource with no concrete category |
| r1     | REEF_ARCHIVE       | `controlled`         | held separately from r2                            |
| r2     | REEF_ARCHIVE       | `community-governed` | held separately from r1                            |
| r3     | REEF_ARCHIVE       | none                 | `unmarked`                                         |
| x1     | configured nowhere | none                 | reached by no grant, parity's one exception        |

**The rows.** The narrow filters are written in the canonical form `@overture-stack/usher-types`
defines, from the rendering rules in Usher's `decisions.md`: for each category held with `record`
and `view`, one `and` of an `in` over every resource holding it and that category's test, composed
with `or`, plus one `unmarked` clause, a `not` around an `in` listing every concrete value the
catalogue maps, over every resource whose unmarked records are held. A grant without `record` and
`view` contributes nothing. These rows are compared with the real bridge by the records each
returns, not by structure.

| Row                                       | Case   | Result                     | Visible                   |
| ----------------------------------------- | ------ | -------------------------- | ------------------------- |
| anonymous, baseline off                   | 1      | `deny`, `no-grants`        | nothing                   |
| anonymous, baseline on                    | 2      | `narrow`                   | h2, l1, r3                |
| a grant on HEART_STUDY's `controlled`     | 5      | `narrow`                   | h1, h2, l1, r3            |
| `controlled` alone on REEF_ARCHIVE        | 9      | `narrow`                   | r1, h2, l1, r3            |
| HEART_STUDY's `unmarked` by grant, unheld | 19     | `narrow`                   | l1, r3                    |
| every grant                               | parity | `narrow`                   | every record but x1       |
| grants only in another catalogue          | bridge | `deny`, `no-grants`        | nothing                   |
| every grant on a category unmapped here   | bridge | `deny`, `no-grants`        | nothing                   |
| a narrowing whose predicates fall away    | bridge | `deny`, `no-grants`        | nothing                   |
| a misconfigured catalogue                 | config | `deny`, `unknown-resource` | nothing                   |
| a catalogue open by configuration         | none   | `allow`                    | every record, x1 included |

**The three "bridge" deny rows are the ones rendered as an empty filter by a careless bridge**, so the
adapter must receive them as denies and the bridge step must produce them as denies. They are the
cases with grants that still reach nothing, which is why they are listed apart from case 1.

The adapter suite takes the rows that differ in what the adapter must do. Every other case belongs
to the bridge, whose output the adapter passes through unchanged.

---

## The suites

Test names state the requirement, per the repository's testing convention.

### The factory, at startup

| Given                                                                  | Then                                                                                                                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a host-routed catalogue with no mapping in the adapter's configuration | startup fails, naming the catalogue                                                                                                                                  |
| a mapped field absent from the catalogue's index mapping               | startup fails, naming the catalogue and the field                                                                                                                    |
| a mapped field whose mapping shape the adapter cannot enforce on       | startup fails, since enforcing anyway would be guesswork                                                                                                             |
| a catalogue's mapped categories and the categories it declares absent  | each mapped value and each declared absence reach the bridge's registration exactly; `unmarked` excludes the mapped values, and a declared absence adds no exclusion |
| a resource offering a category neither mapped nor declared absent      | the bridge withholds it from this catalogue and logs `category.unmapped`; the bridge's suite tests that, and this one only that the declarations reach it            |
| a valid mapping for every catalogue                                    | one callback per catalogue, and the bridge has every catalogue registered                                                                                            |
| a callback invoked before its catalogue is verified                    | it throws, with the configuration-problem message                                                                                                                    |

**A category left out of the mapping withholds the resources offering it rather than stopping
startup**, so one catalogue's gap never takes down the others, and the `category.unmapped` event,
critical, keeps it from passing as data quietly missing. That is Usher's decision, with declared
absence as the last resort. What each resource offers arrives in the payload, so the check runs in
the bridge, per catalogue, rather than in the adapter at startup.

**A category value present in the data but mapped nowhere is case 23**, served as `unmarked`.
Whether the startup check reads the data's distinct values, and what it does on a mismatch, is still
open in Usher's reconciliation protocol. Its test waits for it, and until then the fixture carries
no such record.

### The callback, as a pure function

| Given the context holds, for this catalogue | Then the callback returns                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `narrow`                                    | the result's filter, unchanged                                                               |
| `deny`, either reason                       | `SqonBuilder.matchNothing` on the catalogue's resource field, as a value through `toValue()` |
| `allow`                                     | the GraphQL router's allow-all value, taken from its package root                            |
| results for other catalogues only           | `matchNothing`, since a configured catalogue missing from the results is a deny              |
| no results at all                           | it throws, because the middleware never ran                                                  |
| a result of a kind it does not know         | it throws                                                                                    |

The `deny` rows are also asserted on the query the GraphQL router then emits, through the recording
search client, since a test on the node shape alone would not catch a filter that compiles into one
that restricts nothing.

### Through the GraphQL router, on every endpoint

The integration suite selects one engine per run, so these suites run twice, once on Elasticsearch
7.17 and once on OpenSearch. Locally only Elasticsearch runs by default, and CI has no OpenSearch
yet. Each row of the fixture table is a principal, and each principal is checked on hits, pages,
counts, facets and exports.

| Suite                                                        | What it asserts                                                                   |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| the request's access reaches the callback                    | on hits, aggregations, saving a set and exports alike                             |
| each row sees exactly its visible records                    | the fixture table's last column, on every endpoint                                |
| an under-privileged principal against a fully-privileged one | the per-endpoint conformance case: the difference is exactly the withheld records |
| every grant against no access control                        | the parity case: identical results, x1 the only difference                        |
| `allow` against no access control                            | identical results, x1 included                                                    |
| one context holding two catalogues' results                  | each catalogue's GraphQL router reads only its own                                |

The parity and per-endpoint suites are the go-live conditions for controlled data recorded in
Usher's roadmap, so they gate the adapter's release as well as its review.

**The adapter's parity suite is its own file, sharing a harness with Arranger's.** The existing
suite in `integration-tests/server/test/accessParity.test.ts` keeps its hand-written filter, since
Arranger must run unchanged with no Usher. Both import the harness from one module: GraphQL router
start-up, the records, pages, facets, exports and the spread of client queries. It is extracted when
the adapter work starts.

**Every "sees nothing" row is paired with a positive control on the same records**, so an empty
result proves a filter denied rather than that a query failed or matched nothing for another reason.

### The failure cases

| Given                                                                | Then                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| the fake bridge uncertain, past its grace period                     | searches, facets and counts serve the open tier alone, marked open-tier only, so a principal holding grants sees exactly what an anonymous one does |
| uncertain, and an export by a suspended principal                    | answered 503 before any row is read, since a file holding only open records would read as complete                                                  |
| uncertain, and an export by an anonymous principal                   | served as normal                                                                                                                                    |
| the fake bridge cold, never having reached the controller            | the request is answered 503, and no query reaches the engine                                                                                        |
| the host mounts the GraphQL routers ahead of the bridge's middleware | GraphQL errors carry `ACCESS_CONTROL_FAILURE_MESSAGE`, an export answers 500 with the same text, and `access_control.evaluation_failed` is logged   |
| a configured catalogue absent from a request's results               | that catalogue denies, and the others answer normally                                                                                               |

### The log events

Written now with the rest and reviewed with them, then committed together with the logging logic
that makes them pass. So no branch carries them failing, and none is marked `todo`, which would let
one start passing unnoticed.

**The callback emits them**, because only it knows a result was applied. It runs once per read, so
one GraphQL request asking for hits and aggregations applies a result more than once, and logs each.

| Given                                           | Then                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| a `narrow` or `allow` result applied            | one access-permitted event per application, naming the subject, the arm, the read path and the request identifier |
| a `deny` result applied                         | one access-denied event per application, naming the subject, the reason and the request identifier                |
| one request applying a result on two read paths | two events carrying the same request identifier                                                                   |
| any event                                       | no token, no payload, no bearer token and no record identifier anywhere in it                                     |

A request with no results at all is the failure case above, logged as
`access_control.evaluation_failed`.

The field set is the provisional one in Usher's `adapter-integration.md`, revisited when the logging
is implemented, and the events use the repository's structured logging envelope.

---

## Each assertion is proven load-bearing

Each suite is inverted once, and the inversion must turn it red. An assertion still green after its
inversion measures something other than what it claims.

| Suite         | Inversion                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------- |
| startup       | name a field missing from the index, and startup must fail                                        |
| callback      | return the allow-all value for `deny`, and the deny tests must fail                               |
| per row       | swap two rows' results, and both rows must fail                                                   |
| parity        | drop one grant from "every grant", and parity must fail                                           |
| failure cases | have the uncertain fake bridge pass a principal's grants through, and the open-tier row must fail |
| context       | drop the context on the aggregation path, and the carrying row must fail                          |
| log events    | log the payload, and the content test must fail                                                   |

---

## Open for review

- **The factory's shape.** The trace above fixes what goes in and what comes out, and the order of
  registration and verification; naming and argument layout are the review's to settle.
- **The three changes outside the adapter.** Which shape the GraphQL router uses to carry the
  request's context, and to expose its resolved mapping, is Arranger's to choose, within the rule that
  both are additive and name nothing of Usher's.
- **The request identifier** in the log events comes from the structured logging envelope, which
  is still being built; if it carries none, the envelope gains one first.
- **OpenSearch in CI.** The suites through the GraphQL router gate go-live on both engines, so CI
  needs an OpenSearch service before the adapter ships.
- **Where the fixtures live.** In the adapter's test directory for now. They could move beside
  `principals.json` when that moves to its approved location, since the bridge step reads them too.
- **The startup check on the data's values.** Whether the data's category values are compared
  against the mapping waits on the reconciliation protocol, as above.
- **Nested access fields.** The first integration's fields are flat. The record is the unit of
  access, so until a nested shape is decided against that rule, the adapter refuses to enforce on a
  nested field at startup.
