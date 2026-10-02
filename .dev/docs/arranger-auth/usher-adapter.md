# Usher Adapter: `@overture-stack/arranger-usher-adapter`

Arranger-specific design notes for the Usher PEP adapter. The general Usher adapter contract (bridge
responsibilities, revocation channel, logging requirements, API contract) lives in the Usher
repo at `.dev/design/adapter-integration.md`.

---

## What the Usher adapter does

The bridge resolves a grants token into an `Enforcement` decision; the Usher adapter acts on that decision
by returning a SQON filter to Arranger's enforcement seam. It does **not** guarantee that filter
reaches every read path; that guarantee is Arranger's side of the split, and today it does not hold.
See [Audit consequences](#audit-consequences) below before designing against this.

General Usher adapter responsibilities (bridge handoff, token caching, revocation channel, fail-secure
mode) are in `adapter-integration.md` in the Usher repo.

**Status:** this file was written before the Phase 0 audit and has
been revised against it. The translation design below holds. Three of its stated assumptions about
Arranger did not, and the Usher adapter cannot be built as specified until Phase 0 items a through c in
[`roadmap.md`](roadmap.md) are done.

---

## Audit consequences

The Phase 0 audit tested the seam this Usher adapter was designed to plug into. Four
results change the Usher adapter's design rather than merely its schedule.

**1. "AND into every query" now holds, as of 2026-08-24.** This item recorded that it did not, on
three of four paths, and that an Usher adapter correctly translating grants would still disclose restricted
data. All three are closed and verified against a live cluster: the export path composes the filter,
aggregations no longer escape it via the ES `global` wrapper, and federation forwards it to remote
nodes. Step 7 of the translation algorithm is therefore a description of current behaviour rather
than of an intended contract.

One qualification carries forward rather than closing. Federation *forwards* the filter, which is
not the same as enforcing it: a remote receives it as an ordinary client SQON and a remote that
ignores it applies nothing, indistinguishably. Treat the federated portion of a result as
best-effort rather than guaranteed.

**2. An empty SQON group compiles to match-all, which makes the absent-resource path
security-critical rather than merely tidy.** Three of the four natural encodings of "restrict to
nothing" restrict nothing:

```
and of no grants   -> {"bool":{"must":[]}}                             match all
or  of no grants   -> {"bool":{"must":[{"bool":{"should":[]}}]}}       match all
not of no grants   -> {"bool":{"must":[{"bool":{"must_not":[]}}]}}     match all
in with empty list -> {"bool":{"must":[{"terms":{"study":[],...}}]}}   the only fail-closed one
```

A clause-less `bool` is match-all in Elasticsearch, and `groupingOptimizer` flattens the `and` case
out of the tree entirely, so the emitted body is byte-identical to one with no server-side filter
at all.

**The deny encoding is decided, and only the leaf form is safe.** With deny required to be expressible as a filter (the callback is total and must return a SQON node), two encodings were compared through the full path:

| Encoding | Raw | After `SqonBuilder.from(x).toValue()` |
|---|---|---|
| `{op:'in', content:{fieldName, value:[]}}` | `{"terms":{"study":[],"boost":0}}`, match-none | **unchanged**, still match-none |
| `{op:'not', content:[{op:'and', content:[]}]}` | `{"bool":{"must_not":[{"bool":{"must":[]}}]}}`, match-none | `{"bool":{"must_not":[]}}`, **match-all** |

`reduceSqon` strips the empty inner combination, leaving `not` with nothing to negate, so deny inverts to allow-everything. Composed, that is worse than it sounds: `AND(client, match-all)` reduces to the client's own unrestricted query. Crucially, `reduceSqon` does **not** run anywhere in `graphql-router`'s compile path, so the negation form is correct until the value passes through the builder once, which is an ordinary normalization step someone adds later.

**No field-free encoding exists, and that is structural.** Every leaf operator requires a `fieldName`, so a field-free form must be a combination, and combinations are precisely what reduce collapses. Both `not[...]` variants collapse identically; `and []` survives but is match-all; `or []` survives as `{"bool":{"should":[]}}`, and that is now **verified against a live cluster: it matches every document**, so it is fail-open like the rest. Not worth building on regardless, since it is a combination and therefore prunable.

So the leaf form is not a compromise but the only encoding whose safety does not depend on a pruning pass leaving it alone. It should be emitted through a named constructor rather than an inline literal, because `{value: []}` reads as an oversight and the obvious tidy-up is the catastrophic form. `matchNothing()` landed in `modules/sqon` on 2026-08-24 and is the constructor to use. Its pinning test asserts the node shape, `SqonSchema` acceptance, round-trip survival through the builder, and the fluent-chain case. An earlier version of this line also asked it to assert the emitted Elasticsearch; **that request was withdrawn as unfulfillable**, since `modules/sqon` has no dependency on `graphql-router` and correctly should not, so satisfying it would mean a hardcoded ES string in a package with no dependency edge to make it fail when the compiler changes. The emitted-ES assertion belongs on the `graphql-router` side.

**Confirmed to diverge from another Overture implementation on this exact input, 2026-08-20.** Lyric
was checked independently against the same case and does **not** reproduce it: a zero-content
`and`/`or` reaches drizzle's `and()`/`or()` with no arguments, which returns `undefined`, and
Lyric's `andOperator`/`orOperator` detect that explicitly and throw `BadRequest` rather than
falling through. So on identical input one implementation fails open and the other fails closed by
deliberate check. Reported by the iMicroSeq submission service from a direct read of Lyric's
translator, not verified here.

That is the concrete justification for the shared conformance corpus, since it is a named input
class where two systems already disagree rather than a hypothetical. It also shows the corpus must
encode a **decision** rather than merely compare the two, because neither behaviour is obviously
correct: "this principal is entitled to nothing" is a legitimate state, not a malformed request, so
a `400` is safe without being right. A boolean visibility expectation would ratify the `400`
instead of catching it, which is why the outcome needs a third state.

**Partly superseded.** The surviving half: an earlier draft said an empty grant set was the Usher adapter's
most common no-access input, and it is not.

- **Grants not loaded is not a legitimate input.** The bridge fail-secures with a 503 rather than
  handing the Usher adapter an empty payload. An Usher adapter invoked without a resolved decision is a bridge bug.
  Unaffected by the correction below.

Two bullets from the earlier version are **withdrawn**, because both were downstream of
resource-equals-catalogue:

- *"No access is encoded as absence from the `grants` map, and must 404 before SQON composition."*
  Absence from the map is not the trigger once a type holds records from several resources; an empty
  **intersection** is. See [step 5](#step-5-replaces-a-404-on-a-missing-entry-and-the-difference-is-not-cosmetic).
- *"`categories: []` produces a non-empty exclusion covering every configured sensitive category."*
  That is exclusion-shaped, which point 4 below says is the wrong shape for failing, and the block
  contradicted the audit twenty lines above it. A category clause is now live from the first release,
  but it is not this shape: it is a positive match per concrete category, with only the residual
  `open` category compiling to a complement.

**The 404 argument was not merely superseded; it was protecting something already public.** The
reasoning recorded here was that a SQON matching nothing returns 200 with zero hits and so discloses
that the catalogue exists. Two problems. Under the corrected model there is no disclosure to prevent:
a nonexistent resource is a field value that matches nothing, and a denied resource is a filter that
matches nothing, so both return 200 with zero hits and converge with no work, which is exactly the
[structural indistinguishability](#a-denial-says-does-not-exist-or-you-lack-access-without-indicating-which)
the denial path now relies on. And even under the old model the thing being protected was catalogue
existence, which `GET /introspection` publishes unauthenticated (see
[Constraints](#constraints-this-deployment-imposes)). So the argument bought nothing on either
reading. It is why the Resolved item below is reopened rather than
amended.

What survives unchanged is the reason the *benign* case matters. The genuinely common empty-exclusion
case is a user holding everything, or a type with nothing configured, and match-all is correct there.

That benign case must still emit an **explicit** match-all rather than an empty
group, precisely because it is common. Two frequent legitimate paths and one catastrophic bug path
otherwise produce byte-identical ES bodies, and `groupingOptimizer` makes the benign case
indistinguishable from *no server-side filter having been applied at all*. That is not only a
debugging problem: it means no log line, metric, or audit trail can tell a fully-entitled user
apart from a total enforcement failure. Emit the match-all so the two are distinguishable at a
breakpoint, in a log, and in a test assertion.

**3. Returning a falsy filter disables access control for that request.** `compileFilter` does
`serverSideFilter || { op:'and', content: [] }`, so `undefined`, `null`, and `false` all mean "no
restriction". Defensive style is the trap here: `(ctx) => ctx.user?.grants && buildFilter(...)`
returns `undefined` when the payload is missing and silently grants everything. Note the contrast:
malformed filter *shapes* all throw and fail closed. The falsy path is the only silent one.

Per the correction above, a missing payload should already have short-circuited upstream with a
503, so the callback should never see one. **The callback must still be total anyway.** The whole
finding of the audit is that this seam converts bugs into silent full disclosure rather than into
errors, and "that would be a bridge bug" describes exactly the input class that has to fail closed.
Two independent guards, because the cost of the outer one failing is not an exception.

**4. Exclusion-shaped filters are the wrong shape for a fail-closed design.** The audit found that
against a structurally unrelated index (`sets`), an exclusion-shaped ACL filter matches every
document while an inclusion-shaped one matches none. The same asymmetry applies generally: an
exclusion filter that fails to compile, targets a field absent from the mapping, or is handed an
empty category list degrades toward full access, whereas an inclusion filter degrades toward no
access.

**This is no longer the open item it was written as.** It said the algorithm
below is exclusion-shaped and called that the Usher adapter's most consequential undecided question. The
replacement algorithm's record clause is a positive `in` over the resources a principal holds, which
is the inclusion shape this finding asked for.

The finding is not simply discharged, because one clause is still exclusion-shaped **by necessity**.
Step 7's provenance ceiling is a `not-in` over the complement, since containment of a record's
multi-valued provenance in the held set is not expressible against a flat keyword array while
disjointness from the complement is. So the asymmetry above now applies to exactly one clause instead
of the whole filter, and it is the clause where an unconfigured value fails **open** while the same
defect on the record clause fails closed. That divergence is the live hazard and is documented with
its conformance case under
[An unmapped resource value must deny](#an-unmapped-resource-value-must-deny-never-be-skipped).

---

## Terminology mapping

**Corrected.** The `Resource` row previously read "Catalogue (one Arranger index config,
backed by one ES/OS index)". That row was the definition the rest of this file was written against,
so correcting it downstream while leaving it standing here would have left the premise intact in the
one place a reader consults out of sequence.

| Usher term                | Arranger term                                                                  |
| ------------------------- | ------------------------------------------------------------------------------ |
| Resource                  | **Not a catalogue.** A value in a field on a record. One catalogue holds records belonging to many resources, and a principal may hold some of them. See [What a resource is, and what it is not](#what-a-resource-is-and-what-it-is-not). |
| Catalogue                 | **A different unit, and written "Arranger catalogue" wherever both are in play.** One `catalogueId`: configuration projecting a schema over one index, never the storage itself. `dcat:Catalog`, and therefore also a `dcat:Dataset`. |
| Dataset                   | **Scoped to this document's technical register.** Here, say **resource** for the unit a grant names and **records** for what an index holds, so that `dataset` never silently picks a granularity. Usher's reader-facing onboarding document deliberately uses `dataset` for a resource, as lay register, and is correct to. `dcat:Dataset` cannot arbitrate between the two: a study satisfies it and a catalogue satisfies it, so the standard makes both senses true and settles neither. |
| Data service              | Arranger itself: `dcat:DataService`, the API a principal queries. Usher is a service and is not a data service, which is the boundary the term draws for free. |
| `categories` include-list | The set of data categories the user is approved to see                         |
| Server-side filter        | A SQON expression returned by `getServerSideFilter(context)`, intended to be ANDed into every query before it hits OpenSearch. "Every" is aspirational: see [Audit consequences](#audit-consequences). |
| Grants token              | JWE payload decrypted by the bridge. The bridge resolves it and hands the Usher adapter an `Enforcement` decision rather than the payload itself; see [Grants payload structure](#grants-payload-structure). |

**Where the Catalogue, Dataset and Data service meanings come from.** Terms defined by [W3C DCAT](https://www.w3.org/TR/vocab-dcat-3/)
take DCAT's meaning here. Testing words against each other inside one corpus is how a group settles on
a word that means something else everywhere else, so an outside reference governs wherever one exists.
**That reach has a limit**, recorded in the Dataset row: DCAT spans granularities, so it cannot be
cited to settle which granularity a word should name.

`dcat:Catalog` is a sub-class of `dcat:Dataset`, which is a sub-class of `dcat:Resource`. So a
catalogue *is* a dataset, and the narrower word says more rather than something different. Reading the
two as competing answers is the available mistake, and it inverts the conclusion.

**Why a catalogue is configuration rather than storage**, which is what the Catalogue row asserts: two
catalogues can be configured over one index, and removing a catalogue deletes configuration while the
index and its records remain. Both are claims about what the software permits. The evidence is the
absence of any constraint comparing index names across catalogues, and the absence of any code path
that deletes a data index.

Arranger's published glossary already calls a catalogue "one searchable dataset", written with no
knowledge of DCAT. That is corroboration rather than conflict, reached independently, which is worth
more than an internal agreement would be. It corroborates the mapping and is not a model for phrasing
here: the Dataset row governs this document's own register.

---

## Grants payload structure

**Superseded.** The previous version of this section stated that a resource ID equals a
catalogue ID. Every consequence of that premise is wrong rather than imprecise, including the
algorithm below, which is why both sections are replaced rather than corrected in place. Written in
accordance with Usher's grants model; the corrections marked below are this repository's.

The bridge does not hand the Usher adapter a payload to interpret. It returns a resolved decision, and the
Usher adapter acts on it:

```ts
type Enforcement =
  | { kind: 'deny';   reason: 'no-grants' | 'unconfigured-resource' }
  | { kind: 'narrow'; sqon: SqonNode }
  | { kind: 'allow' }
```

**`Enforcement` is the bridge's return type, not the callback's.** The Usher adapter receives three arms
and returns one `SqonNode`, which is what `GetServerSideFilterFn` expects today. All three values in
the table below exist now, so this section is implementable without any seam change.

Widening the seam ([Phase 1 item 5](roadmap.md)) buys something this cannot express: **the ability to
say different things to different requesters.** A bare `SqonNode` yields one behaviour for every
denial, which is correct for a requester with no relationship to the resource and wrong for one who
holds a lapsed or insufficient grant. See the denial path below; the widening is for the second case,
and reading it as being about a status code produces two denial paths and reintroduces the oracle.

Each arm has one expression, and none is a hand-written literal:

| Arm | What the Usher adapter returns to the router |
| --- | ------------------------------------ |
| `deny` | `SqonBuilder.matchNothing(fieldName).toValue()` |
| `narrow` | The filter carried on the result |
| `allow` | `getDefaultServerSideFilter()`, exported from `@overture-stack/arranger-graphql-router` |

`matchNothing` returns a `SqonBuilderHandle`, so `.toValue()` is required to produce the `SqonNode`
the seam expects. The draft omitted it.

**The callback is total. Returning `null` or `undefined` throws rather than granting everything**, so
an Usher adapter falling through a branch fails loudly. This is why `allow` must be requested by name and
cannot be expressed by declining to answer.

**The `reason` on a denial is for the audit trail and never for the response.** See the denial
section below.

**Both arms are computed locally and neither describes the principal's relationship to the resource.**
`no-grants` is the empty intersection at step 5: this principal's held set did not overlap this type.
`unconfigured-resource` is a resource key with no configuration here, which is a deployment fault. The
token cannot distinguish a lapsed grant from a stranger, so nothing here tries to. It was previously
named `unknown-resource`, which read as though it might mean the second thing; the rest of this
document already says "unconfigured" for exactly this case.

Keeping them apart matters because a misconfiguration otherwise reads as a permissions problem for as
long as it lasts, and an unconfigured value is the dangerous class: it fails closed on records and open
on artifacts.

### What a resource is, and what it is not

A resource is identified by a **value in a field on a record**. It is not a catalogue, an index, or a
GraphQL type.

**One catalogue holds records belonging to many resources.** A clinical catalogue holding twelve
studies holds records from twelve resources. That is why Usher adapter config names a field whose *value*
attributes a record, rather than the catalogue attributing it.

**Config granularity is per queryable type, not per catalogue.** A type composed into a catalogue's
schema is backed by a structurally unrelated index while inheriting that catalogue's configuration. A
filter naming a field that index does not have is emitted verbatim and matches nothing, so every
record of that type disappears. Point it the other way and the documents disappear. Either way it
presents as data loss rather than as an authorization error, which is the hardest kind to attribute.

Before configuring, enumerate every queryable type in the schema, not only the document type the
catalogue was built for. `sets` is the instance that surfaced this, via `createSetsType`.

---

## Core translation algorithm

Per protected type, per request.

**Inputs.** From config: the resources configured for this type, each with the field value that
identifies a record as belonging to it. From the token: the resources this principal holds.

1. Resolve which type is being queried.
2. Take the configured resource set for that type.
3. Take the resources the principal holds.
4. **Intersect.** The visible set is those configured for this type that the principal also holds.
5. **An empty intersection denies this type.**
6. Otherwise **narrow**, with a single positive clause matching the field values of the visible set.
7. For a derived artifact type, **add the ceiling clause**, excluding any artifact whose recorded
   provenance names a resource in the complement, where the complement is the configured set minus
   the held set.

**This algorithm has no category axis and Usher's now does, so treat the steps above as the resource
half rather than as the whole.** Their resolution sequence takes the categories configured for a type
alongside the resources, and narrows with one clause per held `(resource, category)` pair, each a
conjunction of a resource field test and a category field test, composed with `or`. A concrete
category tests for its own configured value; the residual `open` category tests that the field matches
none of the concrete values, which is why that one clause is negative where the rest are positive.

The current shape is Usher's to state and is not transcribed here on purpose: it moved within an hour
of a message about it, and their written corpus lags their decisions, so a copy here would be a second
thing to go stale rather than a second source. Ask their session. What this file should carry is what
the two axes mean for the compiler, which is the paragraph above and the generalization below.

**How the clauses compose, and the third line is this repository's to hold rather than theirs:**

| Boundary | Operator | What it composes |
| --- | --- | --- |
| Within one grant | `AND` | the resource test and the category test |
| Across grants | `OR` | the union of what the principal holds |
| Against the principal's filter | `AND`, always, at every depth | the whole enforcement filter and the client SQON |

The first two describe a grants payload and belong to whoever defines it. The third is a property of
this compiler: `compileFilter` returns `{op: 'and', content: [clientFilter, serverSideFilter]}` with
no branch that can produce anything else, and it throws rather than composing when the server-side
half is absent or clause-less.

**Any mechanism that can put `OR` between the enforcement filter and a principal-supplied clause is a
principal-controlled bypass, whatever depth it occurs at.** That is why this line is written here rather
than left to the Usher adapter: the audit found one, `buildAggregations`'s two nested-filter mechanisms
disagreeing on `should` versus `must`, and a reader who knows only that a filter is "applied" has no
way to tell that a disagreement about a boolean operator three levels down is an access-control
defect. It is asserted by the aggregation fixtures, and a contract whose most important clause exists
only in a test is a contract nobody can read.

### Step 5 replaces a 404 on a missing entry, and the difference is not cosmetic

The previous algorithm returned 404 when the catalogue had no entry in `grants`. The new trigger is
an empty **overlap**.

Where a type holds records from exactly one resource these coincide, which is why the old trigger
worked and passed tests. They diverge as soon as a type holds several: a principal holding two of
five studies in a catalogue has no entry for the catalogue and must still see two studies' worth of
records. Refusing the type is wrong. Filtering is the answer.

The response shape is a separate question; see the denial path below. It is the predicate above it
that has to change.

### An unmapped resource value must deny, never be skipped

A record whose field value matches no configured resource is already excluded by step 6, because the
positive clause does not name it. That **fails closed**, and an implementer can verify it easily.

The same unconfigured value inside an artifact's provenance is absent from the complement, so step 7
does not exclude the artifact. That **fails open**, and one unconfigured contributor lifts the ceiling
on the whole artifact rather than exposing one record.

**So the same defect fails closed on records and open on artifacts.** An implementer who has confirmed
that unconfigured records are invisible has verified nothing about artifacts, and has positive reason
to believe otherwise.

Conformance case: an artifact whose provenance names one configured resource the reader holds and one
unconfigured value, asserted invisible.

### Why the complement can be computed locally

Passing the complement rather than the held set converts subset containment into disjointness, and
disjointness is expressible against a flat keyword array where containment would need a nested
mapping. Do not simplify it into the held-set form: it becomes existential and still passes tests,
because an artifact requiring one held and one unheld resource matches on the held one.

**That caution is general and was written here as though it were local to provenance.** It is the
whole of it: a positive `terms` clause over a multi-valued field asks whether **any** value is held,
so it can never express "every value is held", and it passes a test suite built from records carrying
one value each. Every axis where the intended rule is universal inherits it, not only artifact
provenance. The category axis is the live case, since categories are required in full by design and
their clause is a positive match: a record carrying a held category and an unheld one matches on the
held one and is returned, which is this paragraph with "artifact" and "resource" substituted.

**An axis's intent is not always a fixed property of the axis, which is the trap in the sentence
above.** An axis deliberately existential because some *other* axis carries the restriction inherits
this too, in any deployment where that other axis is absent. The resource axis is exactly that case:
existential is correct while a category clause is being emitted, and the moment the data carries no
category field the resource axis is carrying governance it was never designed for, with the
existential reading now deciding who sees the record. A reader checking "is this axis universal?",
getting "no, a resource is a selection", and moving on will pass over precisely the deployment where
it matters.

The general form also says what closes it, which the provenance-local version left implicit. Adding
the complement clause alongside the positive one gets the universal reading back, and keeping the
positive one is what still refuses a record carrying no held value at all. Neither closes the case of
a record carrying a value nobody configured, because that requires quantifying over an open-ended
space and a `terms` clause enumerates. That residue is data drift rather than configuration drift, so
no startup check closes it durably: a document indexed tomorrow reopens it.

The complement needs only the resources this deployment is configured for, not a global registry,
because an artifact created here can only draw on resources served here. **Over-inclusion is harmless
and under-inclusion is not**, which is the property to remember rather than the formula. Naming a
resource that cannot appear in any provenance excludes nothing; omitting one that can is what lets an
artifact through.

That closure is exactly what the unmapped-value rule above protects.

---

## The denial path

### Two outcomes, and the third is not this Usher adapter's to detect

Build **deny** and **narrow**. There is no third outcome here, and that is a decision on Usher's side
rather than a simplification on this one.

An earlier version of this section required a middle outcome, "some relationship but insufficient", as
a first-class result. Producing it needs the token to say which resources the principal holds a
recorded but non-live grant on, and the grants token carries no such thing: a resource the principal
cannot currently reach is absent, and absence is indistinguishable from never having had a
relationship at all. Expiry and revocation are announced by Usher on the channel already carrying the
grant lifecycle, so a lapsed researcher is told directly rather than left to infer it from a refusal.
Recorded on Usher's side as "A refusal carries no exception, and expiry is announced rather than
inferred".

**The warning this section carried was right, and it is why the change costs nothing.** Retrofitting a
second state into a model whose denial is absence would mean every consumer reading a new field
correctly or failing open, which is the shape the additive model exists to avoid. Deferring a
notification path costs nothing structurally; deferring a token field would have cost precisely what
this section predicted. The conclusion held and the mechanism moved.

**One consequence to carry forward.** The notices are post-MVP. For the first release, a researcher
whose approval lapses gets a refusal that tells them nothing and no message either. That support
burden is accepted rather than overlooked. Nothing in the Usher adapter should try to fill the gap locally,
because every local approximation of it is an oracle.

### A denial says "does not exist or you lack access", without indicating which

This is **oracle denial, not deterrence.** Deterrence would be satisfied by the wording. Denying an
oracle means closing every channel that separates the two cases:

| Channel | How it leaks |
| ------- | ------------ |
| Response time | A denial that performed a grant lookup is slower than one that short-circuited |
| Body shape | Same status, differing structure or fields |
| Side effects | One path emits an audit event or moves a rate-limit counter, the other does not |
| Downstream | Differing cache headers, retry semantics, `Vary` |

**Timing survives review because nobody profiles a 404.** In this algorithm the divergence arrives by
construction: the short-circuit path and the overlap path do genuinely different amounts of work.
Design for it rather than discover it.

The response *shape* is not a flat menu. **A denial expressed as a filter matching nothing achieves
indistinguishability structurally**, because a denied resource and a nonexistent one traverse the same
code doing the same work: same body, and timing that converges by construction rather than by review.
Every other shape achieves the same property by maintenance, and has to keep achieving it.

Side effects stay in scope under either. Two paths returning identical bodies can still differ in
whether they emit an audit event or move a rate-limit counter, and both are observable to someone who
can trigger them repeatedly.

### Ambiguity is owed to every requester, and the cost of that is accepted

The response never indicates which case it is, with no exception, including for a principal who
demonstrably knows the resource exists.

An earlier version of this section carved one out: a principal holding a lapsed or pending grant was
to be told precisely what happened, reasoning that nothing leaks to someone who was told the resource
existed when the relationship was created. **That reasoning is sound and is not why the exception was
dropped.** It was dropped because the Usher adapter cannot identify such a principal. The token makes a
lapsed grant and a stranger identical, so the exception is undetectable, and making it detectable
would mean putting the lapsed state on the wire, which was rejected on its own merits: a second state
in a model whose denial is absence fails open the moment a consumer misreads it.

**The cost this section named is real and has been accepted rather than solved here.** A lapsed grant
is a normal and frequent state in a model with expiry and an acceptance flow, and a refusal that
explains nothing does generate support load. The answer is that Usher tells the person directly on the
channel already carrying the grant lifecycle. Those notices are post-MVP, so for the first release the
load is carried rather than avoided. Written down so a later reader finds the argument already weighed
rather than missing, and does not reintroduce the exception as an improvement.

**Ambiguous outward, precise inward.** The denial reason distinguishes `no-grants` from
`unconfigured-resource` in the audit trail while the response says neither. That pair is what the
reason separates, and it is not the pair the section above declares indistinguishable: a lapsed grant
and a stranger are identical everywhere, audit trail included. Do not helpfully surface the reason:
that split is the design, and it is the thing a later contributor is most likely to undo as an
improvement.

### A live grant can narrow to nothing, and the cause is invisible from outside

A grant can be entirely valid and still match no records. Usher cannot detect it, by design: it never
learns the field names and cannot verify that a category means anything in a given catalogue. This
was written as a post-MVP concern on the premise that categories were not yet the unit being filtered
on; the enforcement clause now names a category field from the first release, so it is live. Walked
through:

1. A custodian or owner defines category X on resource A.
2. Usher records it. It has no way to check what X means, or whether it applies to A, and should not
   have one: that is the data-agnostic position the whole enforcement model rests on.
3. The custodian approves X on A for a researcher.
4. The researcher queries Arranger and receives a token carrying that grant.
5. The Usher adapter maps X to its configured field predicate for this catalogue, and the predicate matches
   nothing. The mapping may be wrong, or the data may genuinely hold no such records.
6. That grant's branch contributes nothing to the composed filter.
7. The researcher receives no data for it. Additive composition means nothing else leaks in either,
   so data covered by no other valid grant stays unreturned.

Steps 6 and 7 are correct and fail closed. The problem is step 5: **a broken mapping and a resource
that genuinely holds no records produce identical output.** As recorded under config granularity above, that presents as data
loss rather than as an authorization error, which is the hardest kind to attribute.

**So the Usher adapter must emit a structured warning when a grant's branch matches nothing.** Not a denial
and not an error: the request succeeded and enforcement behaved correctly. It is the only signal that
separates a deployment fault from an empty result, and without it nobody can tell which they are
looking at.

**Split the audience, because the two halves have different disclosure rules.** A warning surfaced to
the requester may say that a grant they hold matched no records, which tells them nothing they did not
already know, since they know they hold it. It must not say anything about the data's shape, such as
which category is absent from which catalogue, because that is repeatable and maps out the platform.
The diagnosable detail belongs in the structured log, where only operators see it, and where the
person who can actually fix a mapping is looking.

**Not reachable in MVP.** Under resource-level enforcement no category field appears in a query at
all, so there is no mapping to mismatch. Recorded here because the obligation arrives with
category-to-field mapping, and retrofitting a warning path is the same class of rework the three
outcomes above warn about.


---

## Constraints this deployment imposes

Two properties of this repository that the Usher adapter must not assume away. Drafted from description and
**since verified against the source here**.

**Catalogue identity is published unauthenticated.** `GET /introspection` returns the catalogue list
with no authentication and no gating flag (`apps/search-server/src/introspection/index.ts:22`). Under
a resource-equals-catalogue model that endpoint would be the oracle outright, and every channel in
the table above would be irrelevant work. Under the corrected model it is harmless, because publishing
that a catalogue exists says nothing about which resources its records belong to.

**Facet aggregations return the distinct values of a field.** That is what a facet is, so any field
configured as a facet has its value space enumerable through an ordinary query. The server-side filter
is restated inside the aggregation wrapper (`buildAggregations/index.js`, `reapplyServerFilter`), so a
facet on a resource-keyed field returns only buckets the principal may see. **Stated as a property of
the surface rather than as a defect**, because the current behaviour is correct and the constraint is
that it must stay correct. That restatement did not exist before 2026-08-24.

### The rule both instances belong to

**Where a resource's existence is confidential, the values identifying resources must not be
enumerable without authentication.**

The rule is about the value space, not any one endpoint. A resource key mapped one-to-one onto
something published by design is the clearest way to break it. Values appearing in a public facet
listing, a published schema, or a URL are the same hole by another route.

**The condition matters.** Many platforms publish their study registry, and where resource existence
is already public there is nothing to protect. It bites where existence is meant to be confidential,
and the permissions model has that case built in: **an embargoed resource is precisely one whose
existence should not be discoverable before release.** So this is load-bearing the moment anyone uses
embargo, not a defensive rule awaiting a paranoid deployment.

### Two mechanisms, because enumerability is only half statically knowable

**Structurally public: a startup check.** Where the resource key is one-to-one with something
published by design, the values are public whatever the enforcement path does. Readable from
configuration before any request arrives, and it should fail startup rather than warn.

**Behaviourally leaky: a conformance case per surface.** Whether a facet, suggestion endpoint, or
published schema actually applies its filter is a property of the code, not the configuration. A
startup check cannot see it and record-path tests do not cover it.

Do not write the check as "is the resource key faceted". That returns a false positive on the fixed
aggregation path above, because the behaviour changed without the configuration changing, and a check
that fires on a corrected surface teaches people to disable it.

The conformance case compares what an under-privileged principal sees against what a fully-privileged
one sees, per value-returning surface, by running the query and comparing counts. An assertion that
the filter was applied would not catch a wrapper discarding it afterwards. This is the third of the
three constraints already requested on the shared corpus; see [roadmap.md](roadmap.md) P0-0.


## Field-level restriction is a second enforcement surface, not a filter

Usher's model foresees restricting **fields within a record**, not only which records are returned.
This section records what that costs on the compiler side. How the restriction is expressed is
Usher's to state and is not written here.

**Not in the first release on either side.** The access-control service's first release builds record
and artifact capabilities only; field capabilities are designed and arrive by migration, with the
token's nesting shipping now so that adding them later is not a payload version. So there is nothing
to build against yet, and building ahead would mean guessing the expression rather than reading it.
What follows is therefore a costing rather than a plan, and the costing is the point: it is what says
whether the eventual work is one change or several.

**The seam cannot carry it.** `GetServerSideFilterFn<Context>` returns a `SqonNode`, a SQON compiles
to an Elasticsearch query, and a query selects **documents**. It has no vocabulary for which fields
inside a returned document are visible. A predicate and a projection are different things, and the
callback returns only the predicate. So this is a contract change rather than a configuration one,
and it is the first the enforcement seam has needed.

**`_source` is the nearest existing mechanism and it reaches two of six value-returning paths.**

| Path | `_source` today | Consequence for a field restriction |
| --- | --- | --- |
| `resolveHits`, unprefixed | narrowed to the GraphQL selection set, raw names restored | the natural hook; a restriction intersects here |
| `resolveHits`, prefixed | `[nestingPrefix]`, the whole envelope | a `_source` restriction does nothing for a prefixed catalogue |
| `resolveAggregations` | `_source: false` | no document body returned, and bucket keys are the values |
| `resolveSets` | reads `_source[fieldName]` to materialize ids | set creation reads the restricted field server-side |
| `getAllData`, `/download` | no projection at all | whole documents, so exports are unrestricted |
| `copy_to` targets | requested deliberately, via `findCopyToSourceFields` | the value is duplicated into the target and readable there |

Two of those are not oversights to patch and decide whether this is feasible at all.

**Aggregations cannot be reached by `_source`.** The disclosure is the bucket key rather than the
document body: a count grouped on a restricted field reveals its value set and their distribution
without returning a single document. The key and the count fall on opposite sides of the capability
split, which is why the bucket is the wrong unit to reason about: a bucket's key is a field value and
needs whatever permits reading one, while its count is a count and does not. Any field-level model has
to say whether a restricted field is
aggregatable, and a field that must not be aggregated is removed from the schema rather than filtered
from a response.

**`copy_to` duplicates the value at index time**, so restricting a field leaves its content in
whatever field it copies into, and this compiler already walks the mapping for those targets and
requests them on purpose. That makes it a data-modelling precondition rather than an enforcement one,
joining cardinality, per-record category marking, and cross-catalogue identifier uniqueness: asserted
by the integration, checked by nothing, invisible in the emitted query.

**Partial coverage is worse than none, which is the scoping consequence.** Narrowing `_source` on the
unprefixed hits path alone is a small change and would present as field-level access control while
four of the six paths return the restricted values. A reviewer told the feature exists has no way to
see which paths it does not cover. So the honest choice is every value-returning path or none, and
the aggregation path decides, being the only one `_source` cannot serve.

**The general form of that, which is the sharpest thing to carry out of this section.** The usual
reassurance about an unimplemented capability is that it fails closed, and that holds only where a
capability **permits**. Where a capability's absence is what **restricts** a path the service already
answers, an unimplemented check narrows nothing: the service was already serving, the capability
exists to withhold part of the answer, and an Usher adapter that never reads it withholds nothing while the
grant reads as a restriction that took effect. Record-level capabilities mostly permit. **Every
field-level capability restricts**, which is why partial implementation here is not a smaller version
of the feature but a misrepresentation of it.

If it is deferred, this section stays rather than being deleted. A removed future item stops
constraining the present shape and returns later as a migration.

### Both paths prune from one field set, and the choice of how is an oracle question

`resolveHits` calls `getFields(info)` and `resolveAggregations` calls `getFields(graphqlResolveInfo)`:
the same GraphQL AST through the same library, so a read restriction and an aggregate restriction
prune one requested-field set at two points rather than reconciling two independently derived lists.
That is better than it had to be.

What is missing is a shared application point. They are separate resolver factories, so a prune has to
be applied in each, and nothing structurally prevents one being updated and the other not: the same
shape as a value derived differently at one of several call sites. Resolve the restriction once and
pass it through context rather than computing it per resolver.

**The field set decides what to return and not what to compute over, and reading it as both is the
available mistake.** Pruning is subtractive over one result set, so the field set covers it at no
extra cost, including distinguishing a bucket's `doc_count` from its `key`. It does not reach a
response that needs two differently filtered numbers at once, which is what a principal holding view
on one resource and count-only on another requires: a records total over what they may view beside a
discovery count over what they may count. That is one filter short. `getServerSideFilter(context)` is
resolved once per request, and `resolveAggregations` uses that single result for both the query and
the separately compiled server-side query, so one request yields one set for everything in it.

So there are three widenings rather than two, and they are independent: **what to return** (the field
set, free), **which surface is asking** (unnecessary, since the field set is finer), and **what to
compute over** (evaluating the hook once per capability within a request, which nothing today can do).

**Prune silently rather than removing the field from the schema.** Removing it makes a client's query
fail validation with "Cannot query field", which discloses that the field exists and is withheld, and
makes introspection differ per principal. A pruned field returning null is indistinguishable from a
field with no value, which is the same indistinguishability the denial path is built on.

**That is only representable while every generated scalar is nullable, and nothing enforces it.**
`mappingToScalarFields` emits `donor_id: String` rather than `String!` today, which is correct for an
Elasticsearch source where every field is optional. A `!` added later for good reasons would turn a
prune into a resolution error, and the error into an oracle. The constraint costs nothing while it
holds and is invisible until it is broken.

**One surface does not fit.** `getAllData` takes explicit column descriptors from the principal rather
than a GraphQL selection set, so export pruning is an intersection against a third field source. It is
also the path where a field restriction is most likely to be silently absent, because nothing about it
looks like a query.

### Configuration shaping, and the one surface it cannot reach

**What a principal may not use has to leave the configuration too.** A facet, a column or a chart over
a field the principal cannot read discloses that field. Usher's rule for rendering is omission rather
than a marked restriction, since a marked state discloses that something exists.

**The hook already exists.** The configs query is a GraphQL resolver, so it runs per request, at the
same moment `getServerSideFilter(context)` runs on the data paths. It never declares the context
parameter today (`createConnectionResolvers.ts:47`).

**There are six configuration surfaces, and they do not share a gate.** `downloads` and `extended` are
returned unconditionally. `charts`, `facets`, `matchbox` and `table` are returned only for types built
with state, which the `sets` type is not. So shaping is six decisions rather than one. `matchbox` and
`charts` are the two easiest to overlook: `matchbox` names fields for identifier upload, and a chart
names the field it plots.

**The SQON viewer is outside this.** It renders a SQON the principal built or was handed, such as a
shared link or a saved set, rather than configuration Arranger serves.

**Omission needs a signal that something was omitted.** An omitted field is indistinguishable from a
catalogue that never had it, which is the point for the principal and a problem for every honest
consumer. `meta.authFiltered` in the published introspection response says a narrowing happened
without saying what was narrowed, which is the granularity the omission rule needs. It is hardcoded
`false` today (`buildCatalogueIntrospection.ts:68`), and setting it when shaping applies is part of this
work rather than a follow-up.

**GraphQL introspection is the one surface configuration shaping cannot reach.**
`createSchemasFromConfigs` builds one schema per catalogue at load, and that schema serves every
principal. A principal-dependent field list there means a schema per principal, which is an order of
magnitude beyond shaping a response and brings per-principal schema caching with it. Disabling
introspection narrows discovery without closing it, since a principal who knows a field name can still
query it. That fits pruning silently rather than removing fields from the schema: field names stay
discoverable, and values are what is withheld.

**Open, and the developer's decision whether to take on: a design, by MVP, for configuration that can
say a component is not rendered for a given principal**, covering the table and every other component.
The case it serves is a principal holding `count` without `view`, who needs a different page rather
than a narrower one: no records to list, so no table, and a headline count narrowed by whichever facets
that principal may use. Arranger's configuration cannot express a component's absence today, for any
component. No first-release principal holds `count` alone, so what is asked for is the design, not the
implementation.


## Integration point

**Confirmed against the router code. The earlier "Express middleware" framing was
wrong** and is worth stating explicitly, since it is the natural first guess and it leads
somewhere that cannot work.

The hook point is the **`getServerSideFilter` callback passed to `arrangerRouter`**, one per
catalogue. `arrangerRouter` is a single-catalogue unit: it takes one `catalogueId` and one filter
callback. Per-catalogue *isolation* is therefore inherent to the router rather than something
`apps/search-server` adds, which answers the "multiple catalogues per query" question below and
means the Usher adapter ships as a **callback factory**, not middleware:

```
usherArranger({ catalogueId, resourceFields, bridge })  ->  (context) => SqonNode
```

`resourceFields` is keyed by queryable type, not by catalogue, and names the field whose value
attributes a record to a resource. Keyed by type rather than by catalogue because a catalogue's
schema can expose types backed by unrelated indices, with `sets` the live case. The factory closes
over configuration only. Everything principal-dependent is read from `context` per request.

**This shape is now incomplete and the config needs a second field per type.** It was justified in
part by categories being a post-MVP model rather than the unit being filtered on, which is no longer
true: Usher's resolution sequence emits one clause per held `(resource, category)` pair, each a
conjunction of a resource field test and a category field test, composed with `or`. So the Usher adapter has
to be configured with both fields, and a type whose category field cannot be resolved cannot render a
clause at all rather than falling back to a resource-only one. The final shape is Usher's to settle
and is not written here yet; what is settled is that a resource field alone will not serve.

Why not middleware. Middleware sits at the transport boundary, and enforcement has to sit at the
query-building boundary, because Arranger already has more than one transport reaching the same
data (GraphQL, `/download`, the federation resolvers) and has two more planned (Beacon, REST). A
filter threaded through one transport does not reach the others. The audit demonstrated this is not
hypothetical: `getServerSideFilter` is in lexical scope at `graphqlRoutes.ts:473` where the network
schema is built, and is simply not passed, with no type error and no test to reveal it. The full
argument is in [`design.md`](design.md); Beacon is the decisive case, because a Beacon request is
not a GraphQL request at all.

**Two consequences for how the Usher adapter is wired.**

The callback must be **total and synchronous-safe**. It receives the resolver `context` and must
return a SQON node for every input including a malformed one. Bridge calls, token decryption, and
grant fetches therefore cannot happen inside it; they belong in a per-request step that populates
`context` upstream, with the callback reading an already-resolved payload. A callback that returns
a promise, or that returns `undefined` while awaiting one, hits the falsy-filter path and disables
access control for that request.

**The resulting two-layer contract.** Revised: the earlier version had the upstream step resolve
"the resource" against the `grants` map and return **404** on absence. Both halves were consequences
of resource-equals-catalogue. A request does not name one resource, so there is nothing singular to
resolve, and denial is now an empty intersection computed where the query's type is known. The split
itself survives; only its triggers change.

| Layer | Responsibility | Failure mode |
|---|---|---|
| Upstream per-request step (middleware) | Bridge exchange, token decryption, cache lookup. Populates `context.grants` with the resolved set of resources this principal holds. | No resolved payload, **503**, before the callback is invoked. |
| `getServerSideFilter` callback | Pure, synchronous. Intersects the held set with the resources configured for the queried type, and translates the result into SQON. | Total: deny-all rather than nothing, for any input that reaches it despite the layer above. |

The division is what makes the fail-closed property structural. Async work sits where it can
short-circuit the request; the callback is a pure function that cannot be invoked in a state it
does not have an answer for. Note that this is also the only arrangement compatible with the
callback's actual signature, which is synchronous, so the constraint is Arranger's before it is a
design preference.

**The denial decision moved down a layer, and that is a strengthening rather than a weakening.**
Under the old contract the upstream step could deny before composition, which read as the safer
arrangement. It only worked while a request mapped to exactly one resource.

The old arrangement never rested on the layering alone. Point 3 above already required the callback
to be total regardless, because "that would be a bridge bug" describes exactly the input class that
has to fail closed. So the 404 was a primary guard with the empty-case encoding as a backstop, and
**a backstop only fires once the primary has already failed, which means nobody finds out it is
broken until the day it is needed.** Under the new arrangement the empty case is the primary path,
exercised on every denial rather than only after something upstream has gone wrong. Moving a check
onto the path that actually runs strengthens it even though it looks like a demotion.

**Denial cannot be recovered upstream, and the reason is stronger than a missing input.** The
obvious objection is that the middleware could compute the intersection itself, since the configured
set is static. It cannot, and not merely because that would duplicate the callback's inputs: a single
GraphQL document can select **several types with different configured resources**. Every catalogue's
schema exposes `sets` alongside its document type (`schema/index.ts:70`), and those are backed by
unrelated indices. So a request is not one authorization decision. It is one per type resolved, and
"deny the request" is not a well-formed outcome at a layer that has not yet resolved which types are
being asked for. Recovering the short-circuit would mean parsing and interpreting the GraphQL
document in middleware, which is the pattern P0-c just removed for being defeatable.

What preserves fail-closed, then, is not the layer the decision happens in but that deny has a total,
leaf-shaped encoding: see [Grants payload structure](#grants-payload-structure).

### The cost this carries, recorded as a decision rather than a defect

A denial no longer short-circuits above the query, so denied traffic reaches the cluster instead of
being refused cheaply. Structural rather than an oversight, per the paragraph above, so it is recorded
rather than tracked as something to remove.

Two things bound it. Denial is per type, so a request mixing a denied and a permitted type has to run
regardless. And the composed query collapses, which is the part that had to be measured, since the
leaf's behaviour says nothing about the conjunction that actually reaches the cluster.

Measured on the body Arranger emits, taken from `compileFilter` and `buildQuery` rather than written
by hand:

```
{"bool":{"must":[{"terms":{"name":["subject"],"boost":0}},{"terms":{"study":[],"boost":0}}]}}
```

`_validate/query?rewrite=true` returns `MatchNoDocsQuery`, and the profile tree contains only that,
with the principal's clause gone. **Elasticsearch 7.17.28 ~13µs, OpenSearch 2.17.1 ~7µs.** The agreement
is evidence rather than coincidence because the same run shows the planners diverging elsewhere: the
allow-path control is `BoostQuery` over `TermQuery` on one and `ConstantScoreQuery` over
`MultiTermQueryConstantScoreBlendedWrapper` on the other.

**So a denial costs a round-trip and a rewrite, not a search**, and the cost does not grow with the
principal's own query: a `wildcard` clause collapses the same way.

**Both runs are single-node**, so coordination across shards is unmeasured. A denial on a large
sharded index still fans out even though no shard searches.

**Not a conformance-corpus case, despite using the corpus's own filter.** A rewrite is a planning
detail and the corpus compares what a principal can see; two queries returning zero rows look
identical to it whether one rewrote or scanned. This belongs in a benchmark or a profile assertion.

### Choosing an instrument: is there a discriminating pair?

The obvious rule, "an outcome test cannot see mechanism", is wrong: it would rule out the per-surface
conformance cases above, which are outcome tests about mechanism and which work. They work because
comparing an under-privileged principal against a fully-privileged one puts the mechanism in the
**expected relationship between two results**, where neither result alone carries it.

So the question is not mechanism against outcome:

**Can you name two inputs whose results must differ if and only if the property holds?**

| Question | Discriminating pair | Instrument |
| -------- | ------------------- | ---------- |
| Does a denied principal see records | Yes: denied against permitted | Corpus |
| Does a value-returning surface leak | Yes: under-privileged against fully-privileged | Corpus, with per-surface fixtures |
| Which layer produced an outcome | Partly. Some wrong reasons pair; "which layer" does not | Corpus for the pairable half only ([roadmap.md](roadmap.md) P0-0) |
| Did a query rewrite rather than scan | **No.** The results are identical by construction | Profile or `_validate?rewrite=true` |

The last row is the one that carries the rule, and **identical by construction** is the phrase to
keep. A rewrite does not merely happen to produce the same results as a scan; producing the same
results is what makes it a valid rewrite. That puts it permanently out of reach of result comparison
rather than merely hard to detect, which is the difference between choosing a different instrument
and adding more cases.

Note what this does *not* license: the surface cases need their own fixtures but are still corpus
cases. Filing them as a separate instrument would lose the paired-principal discipline that is the
only reason they detect anything.

**An embedder using the lower-level exports does not get the default filter.** Both
`createSchemasFromConfigs` and `getGraphQLRoutes` are public exports, and
`getDefaultServerSideFilter` is applied only inside `arrangerRouter`. So a custom Express server
built on the lower-level exports supplies no callback at all, and that is the case this Usher adapter most
needs to work in. Tracked as P0-14.

**Severity downgraded, and the entry should be re-read before it is worked on.** This previously
said such an embedder gets **unfiltered aggregations and crashing records**, on the grounds that
`resolveAggregations` tolerates a missing callback (`getServerSideFilter && getServerSideFilter(context)`)
while `resolveHits` calls it unguarded. The tolerant call site still exists, but its `undefined` now
flows into `compileFilter`, which rejects it (`resolveAggregations.ts:99`). Both paths therefore fail
loudly and neither serves unfiltered data.

What remains is a developer-experience defect rather than a disclosure one: an embedder gets two
different errors where they should get a working default. That is a real problem and a much smaller
one, and it is worth noticing that P0-a fixed it as a side effect without the entry being updated.

---

## Client-side considerations (`modules/components`)

Everything above is server-side (`graphql-router`). This section is the client half of the same
story, prompted by the multicatalogue work on `DataProvider` (each provider now scoped to one
`catalogueId`, siblings for multiple catalogues on one page, no shared parent component).

**Activation should live inside `DataProvider` itself, not a separate wrapping component.** The
reason is the request boundary rather than the permission boundary: `DataProvider` is the unit that
issues requests to one catalogue's endpoint, so token attachment and denial handling have to happen
where that request is made. Since it is already the per-catalogue unit after the multicatalogue fix,
Usher-aware behaviour belongs there, keyed by that same `catalogueId`, rather than in a separate
context or HOC wrapping several providers at once.

**Corrected.** This previously justified the same conclusion by saying access requirements are
"inherently per-catalogue, matching Usher's resource-scoped grants model", with a parenthetical that
a user can hold different grants for different resources. The parenthetical argues against the
sentence: different grants per *resource* is precisely why per-catalogue is the wrong granularity for
a permission boundary. It is the right granularity for a fetch boundary, which is all this decision
needs.

The practical difference is in what a mixed deployment means. It is not "some catalogues public, some
gated": a single catalogue can be partly visible, because it holds records from several resources and
a principal may hold some of them. So a sibling `DataProvider` cannot render a binary
allowed-or-denied state for its catalogue. It attaches a token and renders whatever comes back, which
may be a full result, a partial one it cannot detect as partial, or an empty one.

**How would a `DataProvider` know the Usher adapter is active for its catalogue?** **Answered: the
introspection capability flag**, over the explicit-prop alternative, because it is self-describing,
matches how catalogue `status`/`error` already work, and serves the separate
backward-compatibility problem too. See [the resolved item](#resolved-since-this-file-was-written)
for the full decision, including the boundary that keeps it safe: the flag stays catalogue-level and
boolean, since one that enumerated resources or varied with the principal would cross the
resource-enumerability invariant.

The rejected alternative was for the consuming app to declare it as a prop, on the grounds that the
app deploying Stage already knows its own auth setup. It needs no server change but pushes the
knowledge into every consumer separately.

**Token/header propagation shouldn't reinvent a new mechanism.** `DataProvider` already accepts a
`customFetcher` prop for exactly this kind of extensibility. A `getAuthToken` callback (or headers
callback) prop, invoked per-request rather than captured once, would let the consuming app own
Keycloak/session token refresh entirely and just hand `DataProvider` a way to read the current
token on demand, no new context needed for the reason discussed for the base-configs idea: this
is a case where the value genuinely changes at runtime and needs to reach a fetch call, not a case
where a shared context is required to avoid prop drilling (the consuming app already renders the
`DataProvider` directly).

**Denial has no UI-facing shape today.** Confirmed in the current code: `useConfigs`'s fetch
failure path (`DataContext/helpers.ts`) does `.catch((error) => console.warn(error))`, a console
warning, not a distinguishable state. A permission-denied response from a catalogue (once Usher
enforcement exists) needs to be told apart from a network or config error, so the UI can render
something like "you don't have access to this catalogue" rather than a silent empty result or a
warning nobody sees. This is a real gap independent of Usher too: worth fixing generally, and
doing it now would give Usher a state to plug into rather than needing its own error channel.

**Anonymous access, client-side implication.** The existing "Anonymous access" open question below
is server-side. The client-side version: an unauthenticated `DataProvider` must keep working, and
what changes is how much it returns rather than whether it succeeds.

**Corrected.** This previously said a `DataProvider` for a gated catalogue "should not" work
unauthenticated, next to one for a public catalogue that should. That reintroduces binary catalogue
state four paragraphs after the section above establishes there is no such state. A catalogue holding
records from several resources, some open, must serve an unauthenticated request and return the open
subset. Failing it would deny access to public data because non-public data happens to share the
index.

So the rule is not per catalogue but per request outcome: anonymous is a principal holding only what
is open, which is an ordinary narrow rather than a denial. A catalogue where nothing is open then
returns nothing, and it reaches that by the same path, which is the structural indistinguishability
the denial path relies on rather than a special case. This still confirms the per-`catalogueId`
activation point above, since token attachment is per provider; it removes the binary
public-versus-gated framing, not the granularity conclusion.

---

## Implementation approach: mock-first

The recommended implementation sequence is adapter-first against a mock grants payload, before
the real Usher service exists. Reasons:

- Forces the grants payload schema to be concrete; reveals gaps before they are baked into Usher.
- SQON composition edge cases (multiple excluded categories, empty grants, anonymous access,
  multiple catalogues in one query) become real problems as soon as there is exercising code.
- The mock evolves naturally into integration test fixtures once Usher is built.

The mock can start as a hardcoded JSON fixture injected by test middleware. The revocation channel
is the hardest part to mock; stub it minimally (no-op push channel, poll returning empty) for the
initial implementation pass.

**The audit supplied a fourth reason, and it is now the strongest one.** Nothing anywhere exercises
a filter that actually filters, which is why three of the four escape routes survived review and
why two of the three previously-known Phase 0 items were found by running code rather than reading
it.

**Updated, and the update is narrower than it looks.** This previously said every test passes
`() => null` or `() => undefined` as `getServerSideFilter`. That is no longer true: the P0-a and P0-c
work replaced them all with `getDefaultServerSideFilter`, since the callback is now total and those
values throw. The guard is genuinely reached on the test path rather than routed around it, verified
at `resolveAggregations.ts:99`, where the tolerant `getServerSideFilter && ...` call site passes its
`undefined` into `compileFilter`, which rejects it.

But `getDefaultServerSideFilter` is **allow-all**, so the repo still has no test whose server-side
filter excludes a single document. The literal claim changed and the argument did not: this fixture
would still be the first one that restricts anything. A mock grants payload is not only a scheduling convenience that decouples this work from
Usher's delivery, it is **the repo's first test fixture that restricts anything**, and it should be
built to be reusable by Arranger's own tests rather than living inside the Usher adapter. Concretely, the
Phase 0 fixes in [`roadmap.md`](roadmap.md) need exactly this fixture to be verifiable, so it is
worth building before them rather than after.

---

## Resolved since this file was written

**Absent resource handling. Reopened and re-decided: a filter matching nothing, not a
404.** This item previously read "Resolved: 404 above SQON composition, never a filter." It was
resolved on a false premise, so it is restated rather than amended.

The earlier reasoning was that a filter matching nothing returns 200 with zero hits and discloses
that the catalogue exists. That holds only while a resource *is* a catalogue, because a nonexistent
catalogue 404s at the router before enforcement runs at all. Once a resource is a field value, a
nonexistent one and a denied one both compile to a query matching nothing and return the same body
after the same work. The 404 would have to be *manufactured*, and manufacturing it creates the second
denial path the [denial section](#the-denial-path) exists to avoid. Catalogue existence is also
published unauthenticated, so the disclosure the 404 was buying was not a secret.

What survives from the old item, and is the part that was always load-bearing: **a no-access case must
never reach filter composition in a shape that compiles to match-all.** Of the four idiomatic SQON
encodings of "restrict to nothing", only `in` with an empty value list fails closed. That is now
satisfied by the encoding rather than by the layering.

The deny value is `SqonBuilder.matchNothing(fieldName).toValue()`, which landed in `modules/sqon` on
2026-08-24. An earlier version of this paragraph specified a raw Elasticsearch literal
(`{"bool":{"must_not":{"match_all":{}}}}`) as a stopgap; **do not use it.** It is not SQON, it cannot
travel through the seam, and it was a third deny encoding coexisting with two others in one document.

The original note still stands, with its example now closed: aggregate counts and facet values must
exclude inaccessible records too, not only the record path. The `global` aggregation escape that
used to break this (P0-9) is fixed; `buildAggregations`'s `reapplyServerFilter` restates the filter
inside the wrapper. The obligation is what carries forward, not the defect.

**Multiple catalogues per query. Resolved: the router gives each catalogue its own filter slot. It
does not give that slot content.** `arrangerRouter` is a single-catalogue unit taking one
`catalogueId` and one filter callback, so catalogues cannot contaminate each other's filters, and one
Usher adapter instance per catalogue is built at startup.

**Corrected.** This item previously said per-catalogue filters "fall out of the
architecture rather than needing Usher adapter logic", and that reading is what resource-equals-catalogue
made plausible. The architecture supplies the isolation; the Usher adapter still has to compute the filter,
and it computes a different one per request, because the intersection depends on the principal's grants.
"Built at startup" is true of the Usher adapter instance and false of the filter it returns. Read the other
way, an implementer would build the filter once at boot and serve everyone the access of whichever
principal arrived first.

The residual risk is not in the Usher adapter: it is that a custom Express server on the lower-level exports
bypasses the default entirely (P0-14), and that federation merges unfiltered remote buckets into the
same response with nothing marking which node produced them (P0-6).

**Client-side Usher adapter detection. Resolved in favour of the introspection capability flag.** Now a
canonical roadmap item (`.dev/roadmap.md` § Capability-aware consumer components via `DataContext`)
and Phase 3 item 14 in [`roadmap.md`](roadmap.md), so it is no longer adapter-specific. It won over
the explicit-prop approach because it is self-describing and matches how catalogue `status`/`error`
already work, and because it serves the separate backward-compatibility problem too. One caveat the
audit adds: `/introspection/:catalogueId` is unauthenticated and ignores
`disableGraphQLIntrospection` (P0-23), so an enforcement capability flag published there tells an
unauthenticated principal which catalogues are gated.

**Decided: acceptable, and recorded as a decision rather than left as a side effect.** The invariant
this could threaten is the one under [Constraints](#constraints-this-deployment-imposes): where a
resource's existence is confidential, the values identifying resources must not be enumerable without
authentication. The flag does not touch that. It says a catalogue applies enforcement; it names no
resource, and it does not distinguish a catalogue whose records are all visible to the principal from one
where none are. So it is a targeting hint, not a disclosure, and the catalogue it points at is already
listed by the unauthenticated `GET /introspection` next to it.

Written down because the reasoning is not obvious from the flag itself, and a reader who notices an
unauthenticated endpoint advertising which catalogues are gated will otherwise reopen it. The boundary
to hold: this stays acceptable only while the flag remains catalogue-level and boolean. A flag that
enumerated resources, named categories, or varied with the principal would cross into the invariant.

**Logging. Resolved as sequencing:** it is Phase 0 item P0-f, not Usher adapter work. The event shape must
exist before enforcement does, with `userId` present-but-null so enforcement can populate it later
without a schema change. The genuinely open half is unchanged: which logging infrastructure these
events ship to, and whether it matches Usher's aggregation destination, which cross-system
correlation by `user_id` requires.

## Current-state questions for the iMS submission service

Added ahead of a three-way exchange (iMS submission service, Usher, Arranger). These are
current-state facts about EGO and Keycloak that cannot be inferred from this repo, because Arranger
performs no authentication at all. Delete this section once answered; the answers belong in the
design sections above rather than here.

Ordered by what blocks the most Usher adapter design if left unanswered.

**Status** after their current-state writeup. Detail for anything answered is in
[Answers received](#answers-received-2026-08-18) below rather than repeated here.

| # | Question | Status |
|---|---|---|
| 1 | Authorization unit, indexed field, nesting depth | **Partly, and the question changed.** The unit at submission is an *organization*, and the target model adds a **per-submission access level**. What to ask the indexing side is now: does the access level survive onto every indexed document, under what field name, at what depth, and does it attach per submission or per record? If it lives on a submission-shaped parent while the indexed unit is a record, Arranger is filtering at the wrong granularity, which is a mapping problem rather than an Usher adapter one. |
| 2 | What a service does with an EGO token to decide access | **Answered.** |
| 3 | What is in the EGO token | **Answered.** `context.user.email`, `context.user.status`, `context.scope`; organization encoded by scope-string prefix/suffix, admin by exact scope match. |
| 4 | Does the iMS deployment set `getServerSideFilter`, reading EGO claims | **Open.** Not submission-service's to answer; they do not deploy Arranger. Belongs to the portal UI session. |
| 5 | Keycloak claim shape reaching the host application | **Still open, but reframed: it may not be answerable from iMS's current deployment at all.** Reported 2026-08-20 via a peer session, originating from the portal UI and **not verified here**: iMS dev runs Keycloak 17.0.1 on the legacy WildFly `codecentric/keycloak` chart, while `overture/infra` dev runs 26.3.3 on keycloakx. If accurate, a nine-major upgrade sits between the current deployment and the target, so the claim shape a host application will actually receive depends on what iMS upgrades to rather than on what it runs now. That makes the Keycloak migration a **prerequisite** of the auth work rather than a follow-up. Verify before relying on it, and prefer the Usher-side write-up once it exists. |
| 6 | How open-access data is represented today | **Open.** |
| 7 | Revocation timing | **Answered.** Equals token lifetime, since status is baked in at issue. |

**Worth noting what did not arrive.** The writeup is a thorough account of EGO and says nothing
about Keycloak, so question 5 is untouched, and it is the forward-looking half of the pair. Every
answer so far describes the system being replaced rather than the one replacing it. That is fine
for understanding what the Usher adapter supersedes, and it means the Keycloak claim shape, which is
the actual input to whatever populates Arranger's `context`, is still entirely unknown. Worth
routing separately rather than assuming it arrives with the rest.

**1. What is the authorization unit, is it an indexed field, and at what nesting depth?** This is the
one that can invalidate the whole translation design rather than merely adjust it. Grants are
expressed per resource with a category include-list, and the Usher adapter turns that into a SQON clause,
which can only reference a field that exists in the catalogue's Elasticsearch mapping and is
filterable. So: what does a permission actually grant access to today (a study, a programme, a
submission batch, a data category), and does the corresponding value exist on **every** indexed
document, under what field name?

**Nesting depth is a separate question from presence, and it has a hard threshold.** Phrased so it
is answerable without knowing anything about Arranger's internals, the answer is one of three:

| Depth of the authorization field | Consequence |
|---|---|
| **0**, top level on the document | Fine. The defective nested-filter code is never reached. |
| **1**, inside one nested object | Works, but by coincidence: a single-element path array stringifies to exactly its element. Correct today, fragile. |
| **2 or deeper** | `createFieldAggregation`'s `:nested_filtered` is dead here (array-to-string coercion), so filtering falls to `injectNestedFiltersToAggs`, which builds `bool.should`. With more than one sibling filter that is **OR where AND was intended**, which for an authorization predicate is an over-disclosure. |

**This is not hypothetical, and the repo's own fixtures show both shapes.** Access-control-shaped
fields appear at depth 0 in `integration-tests/` mappings (`acl` as a keyword, `controlled_access`
and `access_denied` as booleans), which is the safe case. But the same file-centric fixture also
carries `participants.study.data_access_authority` at depth 1, a study-scoped access field living
inside a nested object, and its nesting runs to depth 3
(`participants.family.family_compositions.family_members.diagnoses`). So an Overture-shaped index
can readily place the authorization unit somewhere the defect bites.

If the iMS answer is depth 2 or deeper, the nested-filter reconciliation stops being a
Phase 0 correctness item and becomes a hard blocker on the Usher adapter, and that changes the sequencing
rather than just adding a task.

**2. What does a service currently do with an EGO token to decide whether a user can see data?**
The end-to-end chain rather than the token format: who authenticates the user, who issues the
token, which services validate it, and at which point a data-access decision is made. This is what
tells us precisely which link the Usher adapter replaces and which links stay.

**3. What is in the EGO token?** Claim names and shapes, particularly anything encoding scopes,
permissions, or study-level grants. Asking rather than assuming: this repo has no EGO code to read,
and any prior notion of EGO's scope format is unverified and possibly out of date for this
deployment.

**4. Does the iMS deployment set a `getServerSideFilter` today, and does it read EGO claims?**
Arranger's only access-control hook. Whether any deployment uses it is invisible from this repo,
and if iMS does, that callback is EGO-coupled host-side code needing migration even though Arranger
itself does not.

**5. Under Keycloak, what claim shape reaches the host application?** Realm roles, client roles,
groups, or a custom claim, and what stage the migration is at per service. This becomes the input
to whatever builds `context`, which is the layer above the Usher adapter's callback.

**6. How is open-access data represented today?** A flag on the document, the absence of a
restriction field, a separate index, or a separate catalogue. This decides whether the
inclusion-versus-exclusion question above has a cheap answer: if open records already carry an
explicit marker, the inclusion shape costs much less than assumed.

**7. How quickly must a permission change take effect?** Sets the revocation and cache-TTL
requirement, which is otherwise the hardest part of the bridge to specify and the easiest to
over-build.

## Answers received, 2026-08-18

From the iMicroSeq submission service directly. Their scope ends at Song, so the indexing-side
questions were correctly redirected rather than guessed at.

**The authorization unit at submission is an *organization*, not a study.** The write gate is
`hasUserWriteAccess` against `allowedWriteOrganizations`. This partially answers question 1 and
sharpens what to ask the indexing side: does an organization identifier survive onto every indexed
document, under what field name, at what nesting depth.

**The read side does not exist.** `allowedReadOrganizations` is hardcoded to an empty array,
unimplemented rather than merely unused, and the service is a pure write path (submit, commit,
edit) that never reads back other contributors' data for authorization purposes.

Two consequences. First, **"does write access imply read access" is a decision, not a discovery**:
no code anywhere answers it, so it has to be decided in Usher's permissions model rather than found
in either codebase. Usher has framed it as three distinct shapes, which is the right framing and is
a call for the developer rather than for either agent: submitter reads their own submissions;
organization reads everything the organization submitted; or study membership grants access to all
contributions regardless of submitter. For consent-constrained data these are materially different,
and write access does not imply the third.

Second, that empty array is where [Audit consequences](#audit-consequences) point 2 lands in
someone else's codebase. An empty collection is semantically "may read nothing" and is the default
state of every user until the read side ships, so whoever implements it as a query filter will be
writing exactly the code that compiles to match-all in three of four natural encodings. Raised with
them ahead of implementation, since it is far cheaper to get right before it is written. The
generalizable constraint, which Usher is recording on its side too: **an empty collection cannot
safely mean both "no restriction configured" and "restricted to nothing"**, so those need distinct
representations before anything consumes them as a filter.

**Their auth code has zero test coverage** (`authMiddleware.ts`, `verifyEgoJwt.ts`,
`common/auth.ts`), confirmed rather than inferred. Different mechanism from this repo's null-filter
gap, same root cause: nothing exercises the actual enforcement path on either side.

### The authorization unit is not stable across the pipeline

The most structural thing to come out of the exchange, and the reason it went unnoticed is that no
single service can see it. The chain is submission-service, Song, Maestro, Elasticsearch, Arranger,
and the authorization concept changes shape at nearly every hop:

| Hop | Shape of the authorization unit |
|---|---|
| submission-service | organization (`allowedWriteOrganizations`) |
| Song | study plus access tier |
| Maestro to Elasticsearch | whatever the indexing transform emits |
| Usher grants | resource plus category include-list |
| Arranger Usher adapter | a filterable field that must exist in the index mapping |

The Usher adapter sits at the far end and can filter only on what actually reached the index. **If the
unit changes identity at any hop, the translation breaks at that hop rather than at either end**,
and nobody owning a single hop would see it. So "what is the authorization unit" is not one
question with one answer; it is a per-hop question, and the Usher adapter's category-to-field mapping is
load-bearing in a way that has to be verified per deployment rather than assumed. Usher is adding
the same constraint at principle level on their side.

This is also the strongest argument yet for the startup-validation option recorded under the
inclusion-versus-exclusion question below: if the mapping between a grant and an indexed field must
be verified per deployment, verifying it at boot against the live mapping is the cheapest place to
do it, and the only place that catches a pipeline change after the fact.

**Still open and redirected:** the Elasticsearch mapping and indexing-transform questions belong to
Maestro or the Gateway/Pedigree session, not to submission-service.

### From their current-state writeup

Received in full 2026-08-18. Items below are the ones that constrain this design; the source
document is `.dev/docs/auth/ego-integration-current-state.md` in `imicroseq/submission-service`.
All of this is read from their document rather than from their code.

**Revocation lag equals token lifetime, which answers question 7.** Their validity check is
`context.user.status === 'APPROVED'`, and that status is baked into the token at issue time. A user
suspended or revoked after issuance stays approved until the token expires. This is a hard input to
the bridge's revocation and cache design rather than a defect: the EGO token TTL *is* the worst-case
window during which a revoked user retains access, so the Usher adapter's cache TTL cannot meaningfully be
longer than it and gains little by being much shorter.

**Their token verification does not check `iss` or `aud`.** `jsonwebtoken`'s defaults verify
expiry but not issuer or audience. So the check answers "was this signed by the configured key",
not "was this issued for this service". Relevant here rather than only there: it bears on what a
host application can safely put into Arranger's `context`, since a `context` populated from a token
that was never audience-checked carries an identity that may have been minted for a different
service entirely. Raised with them as a checkable question (does EGO use one signing key
platform-wide?) rather than asserted.

**Read authorization does not currently exist on their side, at any layer.** Three separately
documented facts compose: `GET` is absent from their default protected-methods list so it bypasses
the auth middleware entirely; their read controllers perform no per-organization check, unlike the
three write controllers; and `allowedReadOrganizations` is hardcoded empty. It matters for
sequencing, because the read side of the permission model is not being migrated from something, it
is being written for the first time, and Usher's grants model is where its semantics get decided.

**Resolved: not intentional.** Today's fully-open data is a snapshot
of current iMS production, not the target model. Access level is meant to be defined **per
submission**, at submission time or afterwards, and future submissions will carry restricted,
authorized-eyes-only levels. A "public by default unless embargoed" requirement describes today's
data rather than the target, and was corrected on Usher's side too.

### Consequences of the per-submission access model

**Enforcement is required at both layers.** The same data has two independently reachable read
surfaces, submission-service and Arranger, so gating one leaks through the other. Neither service
may assume the other covers it.

That conclusion is correct and unavoidable, and it is also **the convention-rather-than-seam problem
promoted from call-site scale to platform scale**: two independent implementations of one policy, in
different languages, that must agree. The evidence that this drifts is not hypothetical, since
today established that each service independently fails to apply its own single policy consistently
across its own paths. So the design question is not whether both enforce, it is what makes them
agree.

The mitigation proposed to them, and the reason it is cheap right now: **a shared conformance
corpus.** A fixture of records with access levels, principals with grants, and the expected
visibility of each record to each principal, run by both services, which must produce the same
answer. It is the only mechanism that catches the two sides *disagreeing*, as opposed to catching
either one being internally broken. Both services currently have zero tests of their enforcement
paths, so neither has a suite to retrofit, and whichever side builds a fixture first will build
this one anyway. Related to [`roadmap.md`](roadmap.md) P0-0, which asks for the same thing scoped to
this repo alone; if the shared corpus happens, P0-0 should adopt it rather than duplicate it.

**Access levels are mutable, which creates a staleness window nobody owns.** "At submission time or
afterwards" means a level can change after indexing. Arranger filters only on what is in the index,
so the change must trigger a reindex, and between the change and the reindex **Arranger serves a
stale access decision**. Open to restricted is the dangerous direction: that window is
over-disclosure of exactly the data the change was meant to protect, and its size is Maestro's
reindex latency. Worth deciding whether an access-level change needs a synchronous reindex or an
explicit invalidation rather than riding the normal pipeline.

**`sets` and stale access: a claim corrected by verification.** An earlier version of this section
said a saved set's persisted ID list survives an access-level change, and therefore that set
expansion must re-check access at read time rather than trusting stored IDs. **The second half is
wrong, checked against the code rather than reasoned about.**

Set expansion cannot bypass access control, structurally. On the aggregations path,
`resolveAggregations.ts:91` expands `set_id:` into the **client** filter, and `:99` then composes
the server-side filter over the expanded result via `compileFilter`. On the records path,
`buildQuery/index.js:217` turns `set_id:` into an ES terms-lookup clause, which is likewise part of
the client filter. Either way the stored IDs enter as the principal's own filter and the access filter
is ANDed on top, evaluated fresh against the current index at query time. **Stored IDs can only
ever narrow the result, never widen it**, so a set built when a record was open returns nothing for
that record once the access filter excludes it.

This is worth keeping as a positive case rather than deleting: it is the composition seam working
exactly as intended, and it is the clearest in-repo illustration of why enforcement belongs at
composition rather than at each call site. Recorded in [`design.md`](design.md) alongside the
failures.

**What remains true about sets, narrower than first written.** The `sets` root connection returns
stored `ids` verbatim, so reading the set object itself discloses its membership list regardless of
whether those documents are still reachable, which is a "these documents matched this query at that
time" disclosure that no filter on the document index addresses. That is already logged as the
root-level-sets finding and is not new here. The reindex-lag window above is real but is a pipeline
property rather than a sets property. See the existing `sets` entries in [`debt.md`](debt.md).

The architectural convergence from the same writeup (authorization at call sites rather than at a
seam, found independently in both codebases) is recorded in [`design.md`](design.md) as evidence
for the core decision rather than here.

## Questions from an auth-free vantage

A second, distinct group. The seven above are things Arranger needs to know. These are things that
may not have been examined on the other side, and the reason to ask them is structural rather than
clever: **in a service that has always had authentication, the auth layer's assumptions are
invisible, because nothing has ever violated them.** Arranger has none, so every assumption has to
be made explicit here, which produces questions an auth-having service has no occasion to ask
itself. Ask these curiously, not as a review; several may already be handled, and the ones that are
not are more likely to be undocumented than unconsidered.

**A. What are *all* the paths by which data leaves the service, and does each one pass the check?**
The highest-value question, and the one carrying the most transferable evidence. Arranger has
exactly one access-control mechanism, and a deliberate sweep found **three separate paths that
bypassed it** plus a fourth already known: export composed no filter, aggregations escaped it via
an ES `global` wrapper, and federation sent it to no remote node. All four are now closed here, but
the point stands as a question to ask of any service: A service with more
mechanisms plausibly has more seams, not fewer. Worth enumerating the exits (REST routes, bulk
endpoints, exports, admin tooling, webhooks, message publication, error payloads, logs) and
checking each rather than reasoning from the intended path.

Two method notes from running that sweep, offered because they were what made it work: **reading
code was unreliable**, with two of the three previously-known items found by executing rather than
reading; and the sweep only worked once the criterion was "fails *silently*", since a bypass that
throws gets noticed and a bypass that returns 200 does not.

**B. What happens on each failure path, and is the direction deliberate?** Token expired
mid-request, the identity provider unreachable, a malformed token, a user with an empty permission
set. Arranger fails *open* on the last of these, and it took execution to discover, because the
permissive result is indistinguishable from a correct one. "What does the service do when EGO is
down?" often turns out to be answered by accident (a cache, a default, a timeout) rather than by
design, and the answer is worth knowing before Usher inherits it.

**C. Are read permissions and write permissions the same thing?** Submission is a write path;
Arranger is exclusively a read path. If a user may submit to a study, does that entail reading it
back, including other contributors' submissions to the same study? Usher's grants have to express
whatever the real answer is, and a submission-shaped permission model may not carry a read
semantic at all. This is where the two services' models are most likely to disagree without either
being wrong.

**D. What survives the submission-to-index pipeline?** The join that makes question 1 above
answerable, and it spans two systems, so it may be nobody's explicit responsibility. When data is
submitted under a study by a user, what authorization-relevant value ends up on the indexed
document? Is it carried through, renamed, dropped, or reconstructed? Arranger can only filter on
what is in the index, so if the indexing step drops the field the permission model depends on,
neither service is at fault and the Usher adapter still cannot work.

**E. What identity do service-to-service calls use?** Indexing, reconciliation, and health tooling
usually run as a service account, and a service account with blanket read is a complete bypass of
the user-facing model that is rarely thought of as part of auth at all. Related: does anything
downstream of submission read data on a user's behalf while acting as itself?

**F. Does a permission change apply retroactively, and to what?** If a study's access tier changes
after data is indexed, does anything reindex? If a grant is revoked, what happens to an in-flight
export, a cached aggregation, or a saved set built while it was valid? Arranger has a `sets`
feature that persists document ID lists, so a set built under a broader grant is a durable
artifact of a permission that no longer exists.

**G. Can a principal distinguish "this does not exist" from "you may not see it"?** Existence
disclosure through error messages, validation responses, and identifier collisions on submission.
Usher and Arranger already took a position on this (an absent resource compiles to a filter matching
nothing, not a manufactured 404), so it is worth knowing whether the submission side draws
the line in the same place, since a principal can otherwise probe one service to learn about the
other.

**H. Who grants permissions, and is that action itself recorded?** The admin model, and whether a
permission change produces an audit event. Arranger has no structured logging at all today, so
there is nothing to correlate against on this side yet, which makes the other side's answer the
constraint.

## Open questions

**Inclusion-shaped or exclusion-shaped filters?** Raised by the audit and still the most
consequential undecided item here, though narrower than first written. The empty-excluded-set case
is *not* part of it, per the correction above: that is a legitimate full-access user, and match-all
is the right answer.

What remains is a verified asymmetry in how the two shapes degrade under configuration error. The
audit checked what a filter on a field absent from the ES mapping does, and recorded it as a
negative result for a different question: it is emitted verbatim and **matches nothing**. That is
fail-closed for an inclusion filter and fail-*open* for an exclusion filter, because `not(matches
nothing)` is match-all. So a category whose configured field is misspelled, renamed upstream, or
absent from one catalogue's mapping silently stops excluding, with no error, and the affected
records are exactly the sensitive ones. Inclusion has no equivalent failure: the same misconfigured
field returns nothing and someone notices immediately.

The cost of inclusion is real and lands on Usher's model rather than Arranger's: every record must
carry a category value, so uncategorized records need an explicit representation rather than being
implicitly visible, which makes `categories: []` (member access, uncategorized only) harder to
express rather than easier. Worth resolving before implementation, since it is not a refactor
afterwards. A middle option worth considering first: keep the exclusion shape and validate every
configured category field against the catalogue's live mapping at startup, failing the catalogue
closed on a mismatch. `nestingPrefix` validation already does exactly this and the audit verified it
fails in the right direction, so the pattern exists in the codebase.

**Category-to-SQON field mapping format.** Unchanged, with one added constraint: whatever shape is
chosen must make the empty and missing cases unrepresentable or loud, rather than letting them
compile to an empty group. A field name plus a match value can be validated at startup against the
catalogue's mapping; an arbitrary SQON fragment cannot, and would inherit the `fieldName`-versus-
`field` trap above with no way to catch it.

**Anonymous access.** Still open, and the audit made it worse rather than better. The pattern the
Arranger README documents for this is `if (!userId) return null`, and `null` means *no filter*, so
the documented way to handle an anonymous request grants the full dataset. Federation compounds it:
`allRequestsPassthroughHeaders` defaults to `[]`, so with nothing configured a remote node sees
every federated request as anonymous and applies that same pattern. The question is no longer only
how to integrate the anonymous bridge flow without breaking public access; it is what the
public-catalogue filter should *be*, given that "no restriction" and "not authenticated" currently
have the same encoding and must stop having it.

**Client-side denial UX.** Unchanged as a question, now with an owner: Phase 3 item 13. Confirmed
still true in the current code, `useConfigs`'s failure path in `DataContext/helpers.ts` does
`.catch((error) => console.warn(error))`. The generic blocker is larger than it looked: `DataProvider`
does not inspect GraphQL `errors` at all, so this is a general fix that Usher would ride on rather
than a Usher-specific addition, which is an argument for doing it before enforcement exists rather
than alongside it.

**Platform admin bypass.** Not previously listed here. Phase 2 item 11 specifies skipping injection
entirely rather than injecting an empty filter, precisely because the audit showed an empty filter
and a deliberate bypass are indistinguishable once compiled. The open part is where the admin
determination comes from: Usher's own `role`, an Arranger-side config, or the platform ABAC model,
and whether an Arranger admin and an Usher admin are the same principal.
