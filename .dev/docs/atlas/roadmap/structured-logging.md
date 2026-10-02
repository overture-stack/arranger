# Structured logging: the event envelope

Detail for `.dev/roadmap.md` § Structured request logging as a prerequisite for ABAC. That entry says
what the gap is and where it stands. This holds the envelope decisions, why each was made, and the
two things the shape still owes.

The envelope is settled across Overture rather than for Arranger alone, because access-denial events
have to correlate by principal across services and an envelope agreed after the first emitter ships
is an envelope retrofitted into every consumer that already parsed the old one.

## The standard, verified rather than recalled

[CloudEvents](https://github.com/cloudevents/spec), `specversion` `"1.0"`. The repository carries a
`1.0.3-wip` revision; producers emit `"1.0"`.

Required by the specification: `id`, `source`, `specversion`, `type`. Optional: `datacontenttype`,
`dataschema`, `subject`, `time`.

Extension attribute names are constrained to lower-case letters and digits, should start with a
letter, and should not exceed twenty characters. `data` must not be used as an attribute name. Those
constraints are why everything domain-specific belongs in `data`, where they do not apply, rather
than being promoted to extension attributes.

## Decisions

**`time` is required here though the specification makes it optional, and is narrowed twice beyond
what the specification asks for.** An audit entry with no time is not an audit entry.

The specification types `time` as a Timestamp and requires RFC 3339 encoding. Two further
constraints apply here:

- **UTC, with the `Z` designator, never a numeric offset.** RFC 3339 permits `+05:00` and similar, so
  this is a narrowing rather than a restatement. A corpus carrying mixed offsets cannot be ordered
  without resolving every entry first, and cross-service ordering is the whole purpose of a
  correlated audit trail. Two records written minutes apart can appear a day apart when each writer
  independently picks its own frame, and nothing about the values looks wrong.
- **Seconds are always present.** RFC 3339's `full-time` requires them, so this is a restatement, made
  explicit because truncating to minutes is a normal formatting convenience elsewhere and would
  silently collapse the ordering of events inside one minute. Fractional seconds are permitted and
  not required.

Recorded as deliberate divergences so neither reads as a mistake to whoever next compares this
against the specification.

**`type` is `bio.overture.<entity>.<act>`.** Organization prefix, no service segment, and **exactly
two segments after the prefix**.

The segment count is a rule rather than a shape to aim at, and it is the part most likely to be read
as guidance. A grouping or namespace segment between the prefix and the entity is not permitted: an
existing vocabulary that used one has renames to do, and the normalization is usually either dropping
the group where the organization prefix now does that job, or folding a compound into the act, which
is why acts may be camelCase. Left unstated, anyone holding a three-segment name reads `entity.act` as
a pattern their name already resembles.

**Why a fixed arity rather than any depth, since the obvious answer is the wrong one.** Parseability
is the tempting justification and it does not hold up: prefix matching works at any depth, and few
consumers need to extract the act on its own. The reason is governance. With exactly two segments the
set of entities and the set of acts are each finite, listable and reviewable; with variable depth,
"what entities exist here" has no well-defined answer, because `grant.category.approved` could be
entity `grant` or entity `grant.category` and nothing in the string says which. **A vocabulary whose
shape varies cannot be governed**, and a shared entity vocabulary is precisely what the flat namespace
already owes, so allowing depth would make the owed item unsatisfiable rather than merely harder.

The cost is real and worth stating rather than discovering. Compounds fold into camelCase acts, so the
form uses dots for structure and casing for compounds, two encodings for one idea. And group-level
filtering is lost: subscribing to everything under a former grouping segment now means enumerating its
entities. That is the trade, taken deliberately for an enumerable vocabulary.

The specification says `type` should be prefixed with a reverse-DNS name, and that the prefixed
domain dictates the organization which defines the semantics. The organization is the unit it cares
about. `overture.bio` is the domain. A second namespace turned up while settling this: the published SQON
JSON Schema `$id` read `https://overture-stack.org/schemas/arranger/sqon/...`, on a domain the
organization does not own, most likely the npm scope `@overture-stack/` read as an identity. It now
reads `https://overture.bio/schemas/sqon/...`, dropping the `arranger` segment as well, since SQON is
an Overture-wide entity and the package is the only one in the repository published without the
`arranger-` infix.

Worth keeping rather than treating as an aside: an `$id` is an identifier and a base URI, so one
pointing at a domain nobody owns is squattable by whoever registers it. The exposure here was bounded
because every `$ref` in that schema targets an internal `$defs` entry, so ordinary validation never
dereferences. It is also the concrete reason `dataschema` stays optional below.

**A service segment was considered and rejected**, and the reasoning is worth keeping because the
first instinct is to include it. The emitter is not what distinguishes one occurrence from another:
the entity is. A denial of a grant and a denial of a query are different occurrences, and
`entity.act` separates them with no service segment, where a service segment encodes the emitter
twice and still leaves one act name meaning two things. `source` already carries the emitter, and
`source` plus `id` is the uniqueness key that makes deduplication possible, which `type` plays no
part in.

**`dataschema` stays optional.** Promoting it to required by convention would commit the platform to
publishing versioned schemas at stable resolvable URIs and keeping them resolvable, since an
incompatible schema change needs a different URI. This corpus has already shipped a published `$id`
pointing at a domain nobody owns, so that surface is not one to multiply across every event type on
the strength of a naming convenience. Entity names resolve the same ambiguity, cost nothing, and host
nothing.

**One `source` per deployment.** A source may include more than one producer, so stateless replicas
sharing one store are one producer that happens to run several times: they share a source and put
instance attribution in `data`.

"Logical producer" is the phrase that needs pinning, because it is wrong in both directions. Per
process breaks deduplication, since one logical occurrence emitted by two replicas lands under two
uniqueness keys and nothing catches the duplicate. Per organization merges two independent
deployments serving different platforms into one source and makes their events indistinguishable. A
deployment is the unit: two deployments are two producers, and twelve replicas of one deployment are
one.

Cross-replica coordination does not disturb this. A counter shared across instances, for a threshold
evaluated over a rolling window, is shared state rather than a second producer.

**The principal is `actorId`, never `userId`, and this one is a trust boundary rather than a naming
preference.** `saveSet` takes `userId` as a client-supplied GraphQL argument and persists it to the
sets index, so that value is caller-asserted. An audit principal must be server-derived from the
token and can never be caller-asserted. Two fields with one name invite reading the stored value as
an audit identity, which is the one thing it must never be. Both fields stay and neither is renamed
into the other: `userId` on a set is the owner of a stored object, `actorId` on an event is who
performed an occurrence.

**`actorId` carries the identity provider's subject.** A correlation key has to be producible by
every service that correlates on it, and a service's internal primary key is not visible to the
others. The `sub` claim is.

**`actorType` carries four values: `human`, `serviceAccount`, `anonymous`, `system`.** Two of them are
ways of being absent and they are different facts. A system event has nobody behind it; an anonymous
request has somebody whose identity was never established. A single null would flatten the pair, and
an empty identifier beside `human` reads as a known person whose id failed to record. Keeping
anonymous distinct also keeps open access countable.

## What the shape still owes

Neither of these is settled, and both are larger than the naming decision they arrive under.

**A `source` convention.** There is none, and `source` plus `id` is the deduplication key, so an
undisciplined `source` breaks deduplication whatever `type` looks like. This is owed by any version
of the envelope rather than being a cost of the decisions above.

**A shared entity vocabulary.** Flattening the namespace means one entity name must mean one thing
across services. Only the flat form owes this, and it is a larger commitment than the naming decision:
the failure is silent, since two services emit one `type` with different `data` and a consumer joins
them.

Two live examples, and neither is the kind of word anyone would flag. `set` already means a saved set
here and could mean something else elsewhere. `revocation` is an entity in the access-control model
and is plausibly an entity elsewhere meaning something adjacent but not identical: revoking a token,
a grant, and a session are three occurrences that three services could each name `revocation.creation`
in good faith. The collision arrives through ordinary words used precisely, which is why a registry of
reserved names would not catch it and a shared vocabulary is what is actually owed.

## Deliberately not built

A shared TypeScript package for envelope construction and validation. Two services need this today,
both TypeScript, and four attributes are within hand-rolling. A package earns its keep at the third
or fourth adopter, by which point the shape will have survived contact.

A JSON Schema for the envelope is the cheaper artifact and does the load-bearing work: it states what
conformance means, gives tests a target, and lets services still on another runtime conform by hand
without waiting for a library.

Out of scope under any version: transport, sinks, formatting, and correlation-id propagation. The one
thing services can share is a schema; the one thing they will never share is how bytes reach a
destination.

## What this means for Arranger specifically

The planned per-request fields (`catalogId`, `queryType`, `sqonSize`, `hitsReturned`, `durationMs`)
become `data` contents under the envelope. Nothing about them changes except that `userId` in that
plan is `actorId`, for the trust reason above, and its absent-now-populated-later treatment is what
surfaced the cross-service correlation question in the first place.

**`catalogId` needs its spelling settled before it ships.** It is carried over from the roadmap entry and misses the `catalogue` spelling chosen for this codebase, which the tech-debt entry on inconsistent `catalogue` spelling tracks for surfaces that have already shipped. This one has not, so it is the free moment to name it `catalogueId`; once a consumer parses it, the spelling is a contract. The envelope is shared across Overture, so the choice is Usher's to match.

**The first structured event Arranger emits is likely to be a `system` one.** A catalogue-load
diagnostic is triggered by no principal, so it carries `actorType: system` and no `actorId`. That is
a good property rather than an awkward one: the template gets exercised on the case with no actor at
all before anything with a real principal is emitted, where the usual failure is a shape designed
around the populated case with absence bolted on by whoever first hits it.
