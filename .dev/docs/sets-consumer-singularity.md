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

## Open question: does Singularity replay a set's `ids`, or re-run its stored `sqon`?

**Unresolved, and deliberately not attributed to portal-ui**, who cannot see it: their entire
contribution is to hand over an opaque `setId` and never look at it again.

The question matters because a set document stores both. `ids` is a keyword array materialized at
creation time, so replaying it yields a fixed document list that outlives any later change to the
index or to who may see what. `sqon` is the query that produced it, so re-running it re-evaluates
against the index as it currently stands. The two behave identically on the day a set is made and
diverge from then on.

**One piece of adjacent evidence, marked as unverified inference and not as a finding.** Drawn from
Singularity's deployment configuration rather than its source: its container environment carries a
search-engine host, an authentication toggle, and exactly one index-name variable, with no Arranger
endpoint variable and nothing resembling SQON-evaluation configuration. Re-running a stored SQON
would require Singularity to translate SQON into a search query itself, which is a substantial
capability with no configuration footprint. That leans toward `ids` replay. It is a lean.

**The authoritative answer is in the Singularity service repository**, which neither session has
checked out. One direct look there settles it, and it is worth doing before anything is designed
around either answer.

**Until it is settled, assume the answer is `ids`.** Requested by the reporting session and worth
following: it is the reading their own deployment-config evidence leans toward, and it is the more
constraining of the two, so a change to Arranger's sets surface designed against it is safe under
either answer. They have found the Singularity repository checked out on this machine, outside their
approved working directories, and have asked their developer for clearance to read it. No live
session owns that repository. They will send the answer as a follow-up to be amended in here rather
than holding this document open.
