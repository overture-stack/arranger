# Sets consumer: portal-ui's clinical download path and Singularity

A real integration that depends on Arranger's sets feature, recorded 2026-08-25 because Arranger's
own documentation did not know it existed: **`Singularity` appears nowhere else in this repository**,
in code, docs, or devctx. So anyone working on sets here could not see who depends on the surface
they were changing.

**Provenance.** *Source:* the `virusseq-portal` application repository, at the paths cited inline
throughout this document, plus the infrastructure repository at
`envs/prod/imicroseq-prod/stateless/helm/singularity/values.yaml` and its sibling
`portal-ui/values.yaml`. No commit ref was recorded for either, so the paths are re-runnable and the
exact revision is not.

*Route, a footnote and not the evidence:* reported by a peer session, retracted when its developer
told it that it did not own this surface, then re-read claim by claim against current code by the
portal-ui owner rather than inherited from the first read. That history is here only because it
bounds what the document claims.

*Status:* **not verified from this repository**, because none of it is in this repository. A later
reader re-runs the check by opening the paths above, not by asking anyone.

**Scope: the clinical data path only, and this is a real limit rather than a formality.** Portal-ui
has a second download path that touches neither sets nor Singularity; see the section after next.
Everything here describes the clinical path. One question is deliberately left open rather than
answered; see the last section.

Infrastructure hostnames are omitted throughout, described by variable name rather than value.
Index names are given, because they are already public and because withholding them made a claim
below ambiguous in a way that mattered; see the note under point 1.

## The flow

Portal-ui talks to Arranger and to Singularity as two separate services. Singularity does not
appear to talk to Arranger at all.


    portal-ui  --GraphQL-->  Arranger        (explorer, facets, saveSet)
    portal-ui  --REST----->  Singularity     (archive build, download)
    Singularity --direct-->  search engine   (its own credentials)

The hedge in that sentence is deliberate and the reporting session asked for it to stay. Their
evidence is the absence of any Arranger endpoint variable in Singularity's deployment
configuration, which is strong but is absence-of-evidence: a hardcoded default inside the service,
or a URL arriving within one of the secret-sourced variables, would not have appeared, and
credential-bearing lines were deliberately excluded from what was examined.

Concretely, for a filtered or row-selected download:

1. `saveSet()` (`components/pages/clinical/RepoTable/helper.ts:44`, the mutation text itself at `:34`) runs Arranger's `saveSet`
   mutation and takes the returned `setId`.
2. `startArchiveBuildBySetId()` (`global/hooks/useSingularityData/index.ts:147`) POSTs `{ setId }`
   to Singularity's `/build-archive/set-query`.
3. `saveSetThenBuildArchive()` (`components/pages/clinical/RepoTable/index.tsx:204`) is the whole
   sequence: await the set, log an analytics event, await the archive build.
4. Singularity returns an `Archive` with its own `id`, and the browser navigates to
   `/download/archive/{archive.id}` (`index.tsx:225`).

**Sets are only created for the filtered or row-selected case.** With no filters and no row
selection, portal-ui skips set creation entirely and calls `fetchLatestArchiveAllInfo()`, reusing
the most recent completed archive.

## The other download path, which uses neither sets nor Singularity

**Portal-ui's environmental data path builds its download in the browser.** It issues a plain
Arranger query rather than the `saveSet` mutation, assembles the file client-side with JSZip, and
imports nothing from Singularity. So the flow above, and the open question at the end of this
document, describe **one of portal-ui's two download paths**.

Two consequences on the Arranger side, both inference from that shape rather than reported findings.
The enforcement point for this path is the ordinary record-fetch resolver, not the export route, so
it inherits the server-side filter composition that path already applies. And any limit configured
on Arranger's own `/download` route does not constrain it, because it never calls that route; what
bounds the result is whatever page or record cap the query itself carries.

**Naming the scope is the fix, and the shape is worth noting because it recurs.** The reporting
sessions and this one have now made the same error three times between them in as many rounds: a
claim written at a wider scope than its evidence supports. Twice here, in "its index" covering two
indices and in "not durable" covering two properties, and once there, in "portal-ui" covering an
application when the evidence covered one of its data paths. In every instance the sentence read as
settled rather than as provisional, which is what makes this class expensive: an open question that
still looks open is cheap, while one wearing a finding's clothes is not.

## What Singularity is

A Spring Boot service that builds downloadable archives for the portal, bundling metadata with
FASTA sequence files into a single file. It also serves the portal's contributor list and aggregate
counts (`/contributors`, `/aggregations/total-counts`), which is why the About and Releases pages
call it. It has its own Postgres, S3 object storage, and a Kafka consumer on a Song upload topic.

## The three things that matter for Arranger

**1. Arranger is not the only reader of the `clinical_centric` data index.** Singularity reads it
directly with its own credentials from a Kubernetes secret, and portal-ui has Arranger configured
to serve the same index. Two consumers read one index, one through Arranger and one around it, so
any access control Arranger enforces covers one of two paths.

**The index must be named here rather than described, because "its index" is ambiguous between two
and the evidence covers only one.** The claim above is about the **data** index, and it rests on
deployment configuration rather than on either session's reading of application code.
Whether anything reads the **sets** index (`arranger-sets`) directly is precisely the open question
at the end of this document, and portal-ui has no evidence either way. A reader who took "its
index" to include the sets index would come away believing a second direct reader of `arranger-sets`
had been confirmed. It has not.

Naming `clinical_centric` is not a disclosure: portal-ui ships it to the browser as a
`NEXT_PUBLIC_` variable, so it already sits in client-side JavaScript on a public site. Hostnames
are a different class, describing reachable infrastructure, and are still omitted throughout.

**This is the expected shape of the architecture, not a defect anyone introduced.** Arranger is a
query and aggregation layer over Elasticsearch, not a data-access gateway, so a second service
reading the index directly with its own credentials is normal. The observation matters for design
rather than for blame: it means enforcement placed in Arranger does not reach that consumer, which
is the dual-layer problem with a second party nobody had named.

**2. The set ID is not *exposed* in this flow, which downgrades a concern raised here earlier.**
The reasoning on this side had been that a set ID travels outward and might function as bearer
authority. In this flow it does not travel: it lives in an in-memory `const` inside one async
function, moving from an Arranger response body straight into the next request's POST body, and
never reaches a human, a URL, a filename, or persistent storage.

**Two limits on how far that generalizes, both raised by the reporting session.** It is true of
portal-ui's clinical download flow rather than of Arranger set IDs as such: another consumer could
put a set ID in a URL or hand it to a user, and nothing here constrains that. And what was
downgraded is **exposure, not lifetime**. The set document persists in the index, so the ID
presumably keeps working for as long as it does; it is simply that nobody outside that function
sees this one. Anyone designing set expiry or reuse should treat "not exposed" and "not durable" as
different claims, of which only the first is supported.

**3. The exposed identifier is the archive ID, not the set ID**, and it belongs to Singularity. It
appears in the download URL. The reporting session also flagged, on their own surface rather than
ours, that Singularity's `/archives` listing endpoint is unauthenticated and paged, so completed
archive IDs are enumerable. For open data that is a design consequence rather than a defect, and
they raised it with their own developer. It is recorded here only because it becomes relevant in
one specific case: if Arranger's sets ever gate access to something non-public, this path needs
looking at in the same pass.

## Access control in this path: none, and not by delegation either

Nothing in the flow applies access control. To be precise, it is not that the set ID is treated as
sufficient authority; nothing is treated as authority, because nothing is checked.

Portal-ui has an authenticated fetcher (`global/hooks/useAuthContext.tsx:107-112`, the
`Authorization: Bearer` header at `:110`), and neither of these calls uses it. The Arranger fetcher sends only
`Content-Type`. `startArchiveBuildBySetId` sends only `Content-Type`. The archive download is a
bare `window.location.assign` to a public endpoint with no header.

In the reporting session's own words, which are worth keeping verbatim because they are the honest
answer rather than a hedge: this is the public data portal, so **"the data is open so it never came
up"** is very close to accurate.

## Answered 2026-08-31: Singularity replays the materialized `ids`

**Confirmed by the Singularity session from its own source**, which supersedes the deployment-config
lean this section previously carried. `SetQueryArchiveRequest.arrangerSetTermsQuery` builds an
Elasticsearch `termsLookupQuery("_id", TermsLookup(arrangerSetsIndex, setId, "ids"))`, so the search
engine dereferences the `ids` array server-side and Singularity never fetches or inspects it. That
same query object reaches the scroll over the file-centric index. The stored `sqon` is read, but its
only use is as one component of an archive dedup hash. There is no SQON parser and no translation
layer in the service.

**What that settles for Arranger:** a set's membership is fixed when the set is created, and nothing
downstream re-evaluates it. Whatever scoping applied at creation is the only scoping that ever
applies on this path.

## The set is not the access boundary, and the archive is not scoped to a principal

Reported by the Singularity session, who found it while enumerating their own surface to answer a
narrower question, and who asked that three caveats travel with it: it describes application source,
a deployed environment may front the service with authentication at a gateway or ingress, and this
portal's data is substantially public by design, so much of it may be intentional. It is offered as a
property rather than as a finding.

Two properties of that service, established with them and **deliberately not described here**.
Together they mean a completed archive is reachable independently of the set that produced it, and
that the artifact is identified by the query rather than by who asked for it. The mechanisms are
recorded outside this repository, because they describe another team's surface and this file is
public; that team has raised them with their own developer.

**The consequence for this repository's access-control design, which is why the section exists:**
per-principal scoping of sets cannot produce an end-to-end property. Even correct scoping at
Arranger's read path is undone one hop downstream, because the artifact that survives is keyed on the
question rather than on the asker. The general form is worth more than the instance:
**a consumer that materializes a set into a durable artifact creates a new access boundary that
inherits nothing from ours.** Enforcement placed here governs this repository's read path and makes
no claim beyond it.

**A boundary condition rather than a defect**, agreed with that session and recorded on both sides:
keying an artifact on the question rather than the asker is correct for open data, and stops being
correct the moment the data is not open.

## `path: "name"` works only because the field does not exist

Portal-ui creates sets with `path: "name"`, and Singularity matches the stored values against
`file_centric._id`. That alignment is accidental.

**Arranger's half.** `resolveSets.js:42` reads `_source.<path>` with the document `_id` as a lodash
`get` default. That default fires **only when the resolved value is `undefined`**: a `null` or an
empty string is returned as-is. So the fallback is not a general safety net.

**Portal-ui's half, and their finding rather than this repository's.** They traced the literal to
commit `1f4aa5c0d5eea763f262f092dbe3bd1facb8c5ce`, "Set download (#85)", 2021-08-25, which introduces
the whole download feature and never mentions `path` or `name`; it has been carried through five
later refactors unexamined. They also checked the index rather than reasoning from the call site: on
`clinical_centric` every name-bearing field is nested (`file.name`, `repositories.name`) and no bare
top-level `name` exists. Verify against that commit rather than taking this summary for it.

So `_source.name` resolves to nothing on every document, and the `_id` fallback is the only path ever
exercised. Adding a populated top-level `name` to that index would silently change what sets store,
and archive builds would return empty with no error in either service.

**A hazard for whoever fixes it**, reported by the Singularity session: changing `path` does not
change how the downstream service identifies an already-built archive, so rebuilding the same set
serves the pre-existing one. The fix cannot be verified that way, and a stale archive will look like
a working one.

## This document is currently the only record of this contract

The Singularity service has no `.dev/` directory and no devctx, so nothing established here is
written down on that side. Their session has asked their developer whether to bootstrap one and has
not acted unilaterally. Until that lands this file is the integration contract rather than notes
about a dependency, and it should be maintained as one. If a record does appear on their side, point
at it rather than duplicating it.
