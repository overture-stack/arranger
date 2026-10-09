# Usher adapter tests: the step 1 plan

**Status: the interface is agreed from both sides.** In Usher's build order, step 1 is this
adapter: its tests come first, written from Usher's side and reviewed from Arranger's until they are
ready to code against. The adapter is then implemented from Arranger's side. This file is the plan
for those tests. It is roadmap item 10 tested the way item 12 asks, against a mocked bridge and
controller.

Two rules from the build order apply throughout. **The consumer's tests decide the interface's
shape, and the case table decides its answers.** The cases are the numbered ones in Usher's
`.dev/design/token-calculation.md`.

---

## What these tests cover, and what they leave to others

| Concern                                                                  | Where it is tested                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| The adapter's public surface and its failure cases                       | here                                                                                                        |
| What each enforcement result does to records, counts, facets and exports | here                                                                                                        |
| The startup checks on a catalogue's mapping                              | here, with the data-value check waiting on Usher                                                            |
| The log events' presence and shape                                       | here, with their logic filled in once filtering works                                                       |
| How the bridge renders a payload into a result                           | step 2, the bridge's own tests                                                                              |
| The bridge's own answers, 400, 401 and 503, with their text and headers  | step 2, the bridge's own tests; here only that no query reaches the engine                                  |
| The `Usher-Suspended` header and its exposure to a browser               | step 2, the bridge's own tests; here only that it reaches a client through Arranger's stack                 |
| An artifact key and its provenance ceiling                               | step 2, the bridge's own tests; the adapter registers record and open keys until saved sets, roadmap item 8 |
| Telling a denial apart from an empty result                              | roadmap item 5, which widens the seam                                                                       |
| Saved sets                                                               | roadmap item 8                                                                                              |
| Federation                                                               | after the federation posture decision                                                                       |
| The platform admin bypass                                                | roadmap item 11                                                                                             |

---

## One request, traced

The case table's principal, Ana, has accepted a grant on HEART_STUDY's `controlled` records, made
to a group she belongs to (case 5). The baseline is on, so she also holds `unmarked` everywhere it
is open. She queries the synthetic catalogue described under the fixtures below.

1. At startup, with access control on, the search-server image constructs the bridge and passes it
   to the adapter's factory, `createUsherAccessControl({ bridge, catalogues, logger })`. `catalogues`
   maps each catalogue's id to its registration, read from the `usher.json` beside that catalogue's
   `base.json` and passed through untouched; `logger` is the `BridgeLogger` also handed to the bridge.
2. The factory's `filterFor(catalogueId)` returns one `getServerSideFilter` callback per catalogue,
   throwing for an id with no registration, and registers nothing yet. The image passes each to its
   own catalogue's GraphQL router, so a callback serves one catalogue and never learns which one
   from the request.
3. Each GraphQL router fetches its index mapping as it does today, and hands it to the host through
   its `onIndexMapping` hook before the router resolves.
4. The factory's `verify(mappings)` checks the fields of each catalogue holding a mapping, before the
   image starts listening, and then registers every configured catalogue with the bridge in one
   `register` call, keyed by catalogue, since the bridge takes its registrations once and before it
   starts. A second `verify` throws. A catalogue failing to load is registered and never verified,
   so it serves nothing and one bad index never becomes a total outage. The image mounts
   the bridge's middleware after its health routes and CORS and before body parsing, awaits the
   bridge's start, which checks its configuration and imports its key, and then listens. The bridge
   answers 503 until its revocation channel confirms a first check; only then does it install the
   anonymous payload, running the category-gap check for the open tier before any request is served.
   A callback whose catalogue has not been verified throws, so a host that skips the check fails
   closed, and loudly. What a catalogue failing the check does is in the startup suite below.
5. A request arrives. The image records a request identifier in `res.locals.requestId`, generated
   server-side and never taken from a client header. The bridge's middleware, mounted ahead of the
   GraphQL routers, resolves Ana's token and attaches the request's access to Express's per-request
   store under `usher`: her subject, and one enforcement result per catalogue.
6. The GraphQL router carries that store, the request's own `res.locals` object, to the callback on
   every read path as the context's `locals`: hits, aggregations, saving a set, and exports. The
   callback's second argument names the read path.
7. The callback finds this catalogue's result, `narrow`, returns its filter unchanged, and logs that
   it applied it.
8. Arranger's guard checks the filter as received, and composes it with the client's filter. Every
   clause of a compiled access filter carries boost 0, so access restricts results and never changes
   their order, and the bridge's validator refuses a wildcard, the one operator that scores.
9. Ana sees HEART_STUDY's `controlled` and `unmarked` records, and the `unmarked` records of the
   other two studies. Nothing else, on any endpoint.

**Six of these steps need changes outside the adapter**, made with it. Each is additive and names
nothing of Usher's, so a deployment without access control sees no difference:

| Step | Today                                                                                                                                                                                                                                                         | The change                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2    | the image takes one filter callback for every catalogue                                                                                                                                                                                                       | with access control on, each catalogue's GraphQL router gets `filterFor(id)` for its own id                                                                                                                                                                                                                                                                                                                                                                            |
| 3    | the GraphQL router keeps the mapping it fetched to itself                                                                                                                                                                                                     | `arrangerRouter` takes an optional `onIndexMapping(mappingFromIndex)`, called after the fetch and before the router resolves; a throw from it fails that catalogue's construction                                                                                                                                                                                                                                                                                      |
| 5    | no request carries an identifier                                                                                                                                                                                                                              | the image records `res.locals.requestId`, from `crypto.randomUUID()`, before the bridge's layer                                                                                                                                                                                                                                                                                                                                                                        |
| 6    | the callback's context copies `res.locals`, dropping its non-enumerable members, and the callback cannot tell which read path calls it                                                                                                                        | every read path's context carries the request's own `res.locals` as `locals`, set after every spread so neither an application's locals nor an external context can replace it, and the callback receives `{ readPath }` as a second argument                                                                                                                                                                                                                          |
| 7    | a callback refuses a request only as a configuration failure: its throw answers an export 500 and GraphQL with the configuration-problem text, and is logged as `access_control.evaluation_failed`                                                            | a second refusal, `AccessControlUnavailableError`, carrying a text and a `Retry-After` value. The export route answers it 503 with both, before any row is read; GraphQL, `saveSet` included, answers an error with `extensions.code` `ACCESS_CONTROL_UNAVAILABLE` and that text, its data null and its HTTP status as for any execution error. The router documents the code with its other errors, and never logs this refusal as `access_control.evaluation_failed` |
| 8    | a facet that does not filter itself removes its own field's clauses from the merged filter, the access filter's included, so a bare clause on that field inside an `or` loses its alternative and the facet counts fewer documents than the principal may see | the facet removes them from the client's filter alone, and the access filter applies whole; the CHANGELOG records it under Fixed                                                                                                                                                                                                                                                                                                                                       |

**Access never ranks, and needs no change of its own for it.** Arranger compiles every `in`,
`exists`, range and set clause with boost 0, so a narrowing reaching records through different
clauses leaves their order as it is with no access control, as runs on both engines show. A router
unit test pins boost 0 on every clause of a compiled access filter.

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

**The enforcement result and the request's access come from `@overture-stack/usher-types`, and the
registration's shape and the bridge's interface, `KeyRegistration` and `BridgeCore`, from
`@overture-stack/usher-express-bridge`.** The adapter imports the bridge package's types with
`import type` alone, so they are erased at build and an application that never mounts Usher never
loads it; its tests load it, for the Express layer used by the fake bridge. Until the packages are
published, both are installed at the repository root from `pnpm pack` tarballs with npm's
`--no-save`, never a committed local path, so the adapter's manifest names neither, and the branch
merges after both are published. `usher-types` depends on `@overture-stack/sqon` `^1.0.0-rc.6`,
so Arranger's root `package.json` carries an `overrides` entry pointing it at Arranger's own
workspace module. Express is at 4.22.3, the bridge's floor, and the repository requires Node 24, as
both packages do. The adapter's package, `@overture-stack/arranger-usher-adapter` in
`modules/usher-adapter`, requires Node 24 too. It needs no migration-guide section, since no 3.0.x
deployment upgrades into a new package. Components and charts declare no Node version.

    type Enforcement =
      | { kind: 'deny';   reason: 'no-grants' | 'unknown-resource' }
      | { kind: 'narrow'; sqon: SqonNode }
      | { kind: 'allow' }

**The request's access arrives as one value, `UsherRequestAccess`**, read only through `readAccess`
from `@overture-stack/usher-types`, never by its key, `usher`. `readAccess` throws when the value is
missing, invalid, of an unknown version, or not shaped as `attachAccess` leaves it, which is what
the failure cases below exercise. Each catalogue's result is read with `resultFor`, which reads own
members only, and a missing one is a deny. Which per-request store carries it changes only the
host's wiring, never a test of the adapter. See Usher's `adapter-integration.md` for the value and
why each bridge uses its framework's own store.

---

## The fake bridge

The fake bridge is the adapter's only stand-in for Usher, and it follows the build order's rules for
mocks.

- **It holds a fixed, hand-written set of results and refuses anything outside it.** A registration
  or a principal outside that set is recorded, and the harness fails the test on it, rather than the
  fake throwing: the bridge's layer turns a throw from `resolve` into its 503, which would pass for
  the cold row. A mock that answers whatever it is asked lets the adapter define the contract by its
  own appetite.
- **It implements `BridgeCore`**, so a fake that drifts from the real bridge stops compiling, and
  the host mounts the bridge's real Express layer, `createUsherMiddleware`, over it. The fake
  answers only `resolve`; the real layer attaches through `attachAccess` and answers 400, 401 and
  503 with the bridge's own text, so none of those can drift.
- **Its `resolve` has five modes**, each the bridge's own behaviour: normal, from the fixed table;
  uncertain, attaching the open tier with an anonymous principal marked open-tier only and every
  signed-in one marked suspended with a null subject; one principal's exchange failed in normal
  mode, which marks that principal alike; refused, answering `refused`; and cold, answering
  `unavailable`.
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

| Row                                                                            | Case   | Result                     | Visible                                                                                |
| ------------------------------------------------------------------------------ | ------ | -------------------------- | -------------------------------------------------------------------------------------- |
| anonymous, baseline off                                                        | 1      | `deny`, `no-grants`        | nothing                                                                                |
| anonymous, baseline on                                                         | 2      | `narrow`                   | h2, l1, r3                                                                             |
| a grant on HEART_STUDY's `controlled`                                          | 5      | `narrow`                   | h1, h2, l1, r3                                                                         |
| `controlled` alone on REEF_ARCHIVE                                             | 9      | `narrow`                   | r1, h2, l1, r3                                                                         |
| HEART_STUDY's `unmarked` by grant, unheld                                      | 19     | `narrow`                   | l1, r3                                                                                 |
| every grant                                                                    | parity | `narrow`                   | every record but x1                                                                    |
| grants only in another catalogue, this one having registered its resource list | bridge | `deny`, `no-grants`        | nothing                                                                                |
| every grant on a category unmapped here                                        | bridge | `deny`, `no-grants`        | nothing                                                                                |
| a narrowing whose predicates fall away                                         | bridge | `deny`, `no-grants`        | nothing                                                                                |
| anonymous, baseline on, in a catalogue mapping `controlled` alone              | bridge | `narrow`                   | h2, l1; REEF_ARCHIVE withheld whole, r3 included, since it offers `community-governed` |
| a catalogue registering an empty resource list                                 | config | `deny`, `unknown-resource` | nothing                                                                                |
| a catalogue open by configuration                                              | none   | `allow`                    | every record, x1 included                                                              |

The catalogue mapping `controlled` alone is the synthetic one registered again under a second key,
as the two-catalogue row already requires.

**The three "bridge" deny rows are the ones rendered as an empty filter by a careless bridge**, so the
adapter must receive them as denies and the bridge step must produce them as denies. They are the
cases with grants that still reach nothing, which is why they are listed apart from case 1.

The adapter suite takes the rows that differ in what the adapter must do. Every other case belongs
to the bridge, whose output the adapter passes through unchanged.

---

## The suites

Test names state the requirement, per the repository's testing convention.

### The factory, at startup

| Given                                                                                                                                                                                                                                    | Then                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a host-routed catalogue with no mapping in the adapter's configuration                                                                                                                                                                   | startup fails, naming the catalogue                                                                                                                                                                                  |
| a mapped field absent from the catalogue's index mapping                                                                                                                                                                                 | startup fails, naming the catalogue and the field                                                                                                                                                                    |
| a mapped field whose mapping shape the adapter cannot enforce on                                                                                                                                                                         | startup fails, since enforcing anyway would be guesswork                                                                                                                                                             |
| a catalogue's mapped categories                                                                                                                                                                                                          | each reaches the registration exactly, a scoped name such as `global.controlled` against the value held in its records, with the category field named; `unmarked` excludes every mapped value                        |
| a catalogue with no category field, declaring categories absent                                                                                                                                                                          | each declared absence reaches the registration, with no category field and no mapped value, and adds no exclusion                                                                                                    |
| a catalogue's configured resources                                                                                                                                                                                                       | the list reaches the registration, so grants held only in other catalogues deny here                                                                                                                                 |
| a catalogue configured as open                                                                                                                                                                                                           | registered as `{ kind: 'open' }`, with no field names                                                                                                                                                                |
| a mapping refused by the bridge's registration: a category mapped with no category field, two categories mapped to one value, a declared absence beside a category field, or a value or resource holding `*`, `set_id:` or `__missing__` | startup fails before the bridge starts, the refusal naming the catalogue                                                                                                                                             |
| every registration built by the adapter                                                                                                                                                                                                  | accepted by a real bridge's `register`, unstarted, which needs no controller, so a shape refused by the real bridge fails here and not only in the run with the real bridge                                          |
| a bridge configuration refused by `start`, such as an empty event source                                                                                                                                                                 | startup fails with the bridge's refusal, and `bridge.startRefusal` reaches the logger shim                                                                                                                           |
| a resource offering a category neither mapped nor declared absent                                                                                                                                                                        | the bridge withholds it from this catalogue and logs `category.unmapped`; the bridge's suite tests that, and this one only that the declarations reach it                                                            |
| a valid mapping for every catalogue                                                                                                                                                                                                      | one callback per catalogue, and the bridge has every catalogue registered                                                                                                                                            |
| a callback invoked before its catalogue is verified                                                                                                                                                                                      | it throws, with the configuration-problem message                                                                                                                                                                    |
| a catalogue that fails to load, beside catalogues that load                                                                                                                                                                              | it is registered and never verified, so its callback throws if anything reaches it; its load failure is logged, the server's health reports count it as down, never healthy, and the other catalogues serve normally |
| `verify` called a second time                                                                                                                                                                                                            | it throws, since the bridge takes its registrations once                                                                                                                                                             |
| with access control on, a catalogue with no `usher.json` beside its `base.json`                                                                                                                                                          | the image refuses startup, naming the catalogue                                                                                                                                                                      |
| with access control on, a catalogue configuring network search                                                                                                                                                                           | the image refuses startup, naming the catalogue and saying access control does not serve network search yet, until the federation posture is decided                                                                 |
| the bridge cold, before its first check confirms                                                                                                                                                                                         | the image reports not ready, whatever the catalogues report, so no traffic reaches a pod answering 503 to everything; the liveness route answers                                                                     |
| the bridge normal                                                                                                                                                                                                                        | readiness follows the catalogues' status, as without access control                                                                                                                                                  |
| the bridge uncertain                                                                                                                                                                                                                     | readiness still follows the catalogues' status, since the open tier keeps serving through a silence; the liveness route answers in every mode                                                                        |

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

| Given the context holds, for this catalogue                                                                                       | Then the callback returns                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `narrow`                                                                                                                          | the result's filter, unchanged                                                                                                      |
| `deny`, either reason                                                                                                             | `SqonBuilder.matchNothing` on the catalogue's resource field, as a value through `toValue()`                                        |
| `allow`                                                                                                                           | the GraphQL router's allow-all value, taken from its package root                                                                   |
| results for other catalogues only                                                                                                 | `matchNothing`, since a configured catalogue missing from the results is a deny                                                     |
| no request access in the store                                                                                                    | it throws, because the middleware never ran                                                                                         |
| an `usher` member refused by `readAccess`: of another version, holding an unknown kind, or not shaped as `attachAccess` leaves it | it throws through `readAccess` before any result is read; set up by defining the member directly, since `attachAccess` refuses each |

The `deny` rows are also asserted on the query the GraphQL router then emits, through the recording
search client, since a test on the node shape alone would not catch a filter that compiles into one
that restricts nothing.

### Through the GraphQL router, on every endpoint

The integration suite selects one engine per run, so these suites run twice, once on Elasticsearch
7.17 and once on OpenSearch. Locally only Elasticsearch runs by default, and CI has no OpenSearch
yet. Each row of the fixture table is a principal, and each principal is checked on hits, pages,
counts, facets and exports.

| Suite                                                                 | What it asserts                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| the request's access reaches the callback                             | on hits, aggregations, saving a set and exports alike                                                                                                                                                                                                                    |
| each row sees exactly its visible records                             | the fixture table's last column, on every endpoint                                                                                                                                                                                                                       |
| an under-privileged principal against a fully-privileged one          | the per-endpoint conformance case: the difference is exactly the withheld records                                                                                                                                                                                        |
| every grant against no access control                                 | the parity case: identical results, x1 the only difference                                                                                                                                                                                                               |
| `allow` against no access control                                     | identical results, x1 included                                                                                                                                                                                                                                           |
| one context holding two catalogues' results                           | each catalogue's GraphQL router reads only its own                                                                                                                                                                                                                       |
| a catalogue mapping no category values, faceted on its resource field | the facet counts what no access control counts for the same records: a property check, since a canonical narrowing cannot reach the facet undercount, its bare resource test being the `or`'s only alternative, so the fix's coverage is the GraphQL router's own suites |

The parity and per-endpoint suites are the go-live conditions for controlled data recorded in
Usher's roadmap, so they gate the adapter's release as well as its review.

**The adapter's parity suite is its own file, sharing a harness with Arranger's.** The existing
suite in `integration-tests/server/test/accessParity.test.ts` keeps its hand-written filter, since
Arranger must run unchanged with no Usher. Both import the harness from
`integration-tests/server/harness/parity.ts`: GraphQL router start-up behind any handlers mounted
ahead of it, the records, pages, facets and exports each read path answers, with headers such as a
credential on every request, and the spread of client queries, built over each fixture's own fields.

**Every "sees nothing" row is paired with a positive control on the same records**, so an empty
result proves a filter denied rather than that a query failed or matched nothing for another reason.

### The failure cases

| Given                                                                     | Then                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a signed-in principal marked suspended, its subject null                  | searches, facets and counts serve the open tier alone, marked open-tier only, so it sees exactly what an anonymous one does                                                                                                                |
| a suspended principal's export                                            | 503 with the bridge's 503 text and `Retry-After`, before any row is read, since a file holding only open records would read as complete                                                                                                    |
| a suspended principal saving a set                                        | a GraphQL error coded `ACCESS_CONTROL_UNAVAILABLE` with the bridge's 503 text and null data, the GraphQL form of the 503 given to a write by Usher's table, since a set holding only open records would later read as complete             |
| an anonymous principal's export, the bridge uncertain                     | served as normal, since nothing is reduced for it                                                                                                                                                                                          |
| each row above with the bridge normal and one principal's exchange failed | the same answers, since the adapter reads the marks, never the mode                                                                                                                                                                        |
| the adapter's copy of the bridge's 503 text and `Retry-After`             | equal to the bridge's own values, so the two answers never drift                                                                                                                                                                           |
| the fake bridge cold, never having reached the controller                 | the request is answered 503, and no query reaches the engine                                                                                                                                                                               |
| the host mounts the GraphQL routers ahead of the bridge's middleware      | GraphQL errors carry `ACCESS_CONTROL_FAILURE_MESSAGE`, an export answers 500 with the same text, and `access_control.evaluation_failed` is logged                                                                                          |
| a configured catalogue absent from a request's results                    | that catalogue denies, and the others answer normally                                                                                                                                                                                      |
| the fake bridge refusing the credential                                   | 401 from the bridge's layer, and no query reaches the engine; the status and its text are the bridge's suite's                                                                                                                             |
| a narrow result on every read path                                        | the query composed without writing to the filter, which arrives deeply frozen; a write while composing fails the request closed, never into an unfiltered query                                                                            |
| a request reaching the network search read path, whoever the principal    | the configuration failure: `ACCESS_CONTROL_FAILURE_MESSAGE`, logged as `access_control.evaluation_failed`                                                                                                                                  |
| a suspended principal's search, facets and counts                         | the response carries `Usher-Suspended: true` from the bridge's layer, readable by a browser through `Access-Control-Expose-Headers` beside the router's own exposed headers; an anonymous or a confirmed principal's response carries none |

### The log events

Written now with the rest and reviewed with them, then committed together with the logging logic
that makes them pass. So no branch carries them failing, and none is marked `todo`, which would let
one start passing unnoticed.

**The callback emits them**, because only it knows a result was applied. It runs once per read, so
one GraphQL request asking for hits and aggregations applies a result more than once, and logs each.

| Given                                                 | Then                                                                                                                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a `narrow` or `allow` result applied                  | one `access_control.permitted` event per application, naming the subject, null for an anonymous or suspended principal, whether it is suspended, the arm, the read path and the request identifier |
| a `deny` result applied                               | one `access_control.denied` event per application, naming the subject, null for an anonymous or suspended principal, whether it is suspended, the reason and the request identifier                |
| a suspended principal refused on an export or a write | one `access_control.unavailable` event, naming the subject, null, that it is suspended, the read path and the request identifier, and no `access_control.evaluation_failed`                        |
| one request applying a result on two read paths       | two events carrying the same request identifier                                                                                                                                                    |
| any event                                             | no token, no payload, no bearer token and no record identifier anywhere in it                                                                                                                      |
| a bridge event through the adapter's logger shim      | written in the repository's envelope at the bridge's level, `error` for a critical event, with the event's fields unchanged                                                                        |

A request with no access in the store is the failure case above, logged as
`access_control.evaluation_failed`. **Three refusals stay apart in the log**: `access_control.denied`
is a decision, `access_control.unavailable` a decision deferred because the bridge could not confirm
a signed-in principal, and `access_control.evaluation_failed` a fault in the configuration.

The field set is the one settled in Usher's adapter contract: `catalogue`, `readPath`, `requestId`,
`suspended` and `userId`, with `enforcement` on a permitted event and `reason` on a denied one,
`no-grants`, `unknown-resource` or `no-result`. Each event is one JSON line through the adapter's logger
shim until the repository's structured logging envelope lands.

---

## Each assertion is proven load-bearing

Each suite is inverted once, and the inversion must turn it red. An assertion still green after its
inversion measures something other than what it claims.

| Suite              | Inversion                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| startup            | name a field missing from the index, and startup must fail                                        |
| callback           | return the allow-all value for `deny`, and the deny tests must fail                               |
| per row            | swap two rows' results, and both rows must fail                                                   |
| parity             | drop one grant from "every grant", and parity must fail                                           |
| parity order       | give the access filter's clauses a boost above 0, and the ordered parity rows must fail           |
| failure cases      | have the uncertain fake bridge pass a principal's grants through, and the open-tier row must fail |
| context            | drop the context on the aggregation path, and the carrying row must fail                          |
| log events         | log the payload, and the content test must fail                                                   |
| a failed catalogue | mark it verified anyway, and the failed-catalogue row must fail                                   |
| readiness          | report an uncertain bridge as not ready, and the uncertain row must fail                          |

---

## Open for review

- **OpenSearch in CI.** The suites through the GraphQL router gate go-live on both engines, so CI
  needs an OpenSearch service before the adapter ships.
- **Where the fixtures live.** In the adapter's test directory for now. They could move beside
  `principals.json` when that moves to its approved location, since the bridge step reads them too.
- **The startup check on the data's values.** Whether the data's category values are compared
  against the mapping waits on the reconciliation protocol, as above.
- **Nested access fields.** The first integration's fields are flat. The record is the unit of
  access, so until a nested shape is decided against that rule, the adapter refuses to enforce on a
  nested field at startup.
