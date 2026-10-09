# Catalogue field mapping for third-party genomics visualization libraries

Sketched generically ahead of any specific catalogue needing it, since the vocabulary below doesn't depend on which catalogue adopts it first. Nothing here is implemented; this is a shape to react to, not a spec to build against yet.

Full research trail, every candidate surveyed, and what's still unverified: [atlas: Genomics visualization libraries](atlas/visualization-landscape.md). This document stays compressed to what's confirmed and actionable.

## Why this needs a mapping layer at all

`get_catalogue_fields` already reports per-field metadata: `displayName`, `isArray`, `type`, `unit`. All of it is generic, Elasticsearch-level or presentation-level. None of it says a field *means* "chromosome" or "protein change" in a domain sense, and nothing about a catalogue's configuration today lets it say so. A visualization library that expects a `chromosome` field on every mutation object has no way to find it on an arbitrary catalogue without that catalogue declaring which of its own fields plays that role.

The fix isn't automatic inference. It's a small, named vocabulary of concept slots a library's data shape needs, plus a per-catalogue configuration mapping that catalogue's real field names onto those slots. The vocabulary is generic and catalogue-agnostic; the mapping is catalogue-specific, the same shape `displayName` already is.

## Candidates, confirmed separately

Two sources exist: cBioPortal's own extracted packages, and `oncojs`, OICR/softeng's own prior work covering the same ground. They aren't mutually exclusive; the OncoPrint-equivalent and the mutation-plot-equivalent could come from different sources if one side turns out more viable once someone opens the actual code.

**`react-mutation-mapper`** (npm, `0.9.13`, described by its own maintainers as "Generic Mutation Mapper", licensed AGPL-3.0-or-later; licence fit is the renderer app's question, not Arranger's, see the atlas doc). Confirmed directly against its `Mutation` type (`cbioportal-utils/src/model/Mutation.ts`), which is the full field list, not a sample:

| Field | Type | Required |
|---|---|---|
| `proteinChange` | string | yes |
| `proteinPosStart` | number | yes |
| `gene` | Gene | no |
| `chromosome` | string | no |
| `startPosition` | number | no |
| `endPosition` | number | no |
| `referenceAllele` | string | no |
| `variantAllele` | string | no |
| `aminoAcidChange` | string | no |
| `variantType` | string | no |
| `mutationStatus` | string | no |
| `ncbiBuild` | string | no |
| `proteinPosEnd` | number | no |
| `mutationType` | string | no |

Only two fields are actually required to render a lollipop plot: `proteinChange` and `proteinPosStart`. A catalogue's mapping config needs at minimum those two to produce anything; the rest sharpen the plot (exact genomic coordinates, variant classification) without which it degrades gracefully rather than failing.

**`oncoprintjs`** (npm, `6.1.6`, licensed ISC, no licensing concern). Confirmed as a pure rendering engine: "a grid of `m` tracks of `n` types, where each element can either be a discrete value represented by a colored glyph on a grey background or a continuous value within a color range." That's the whole public data model stated in its own docs. The maintainers' own README says full API documentation is still pending and points at the compiled `.d.ts` instead. **Don't treat the conceptual shape above as a field-by-field contract the way the Mutation table is.** At implementation time, read `oncoprint.d.ts` directly for the actual track-spec and data-item shapes rather than building against this paragraph's description of them.

**`oncojs/oncogrid`** (published unscoped as `oncogrid` `3.0.0`, last commit 2018; licence ambiguous, since its manifest says MIT and its licence file Apache-2.0) is `oncoprintjs`'s functional equivalent, built in-house. Its data model, confirmed from its own `API.md`, is a minimal, concept-slot shape: donor and gene objects need only `id`; observations need `id`, `geneId`, `donorId`. Everything else, including clinical fields, is optional and routed through track configuration, independent evidence that the concept-slot-plus-mapping design above already works in practice. Its core dependency, `d3@3.5.17`, is roughly a decade behind current D3; treat "use oncogrid" as "modernize oncogrid's rendering layer using its data model as a reference," not a drop-in.

**`oncojs/lolliplot`** (`@oncojs/lolliplot` `0.10.2` with its React wrapper `@oncojs/react-lolliplot` `0.11.9`, Apache-2.0, last commit 2020) is `react-mutation-mapper`'s equivalent, on similarly dated `react@^15.4.1` and `redux@^3`. No type declaration states its shape, so this table is what its source reads, and which fields are required is not established:

| Object | Field | Role |
|---|---|---|
| mutation | `id` | Identity; the target of `mutationId` highlighting |
| mutation | `x` | Position on the protein, in amino acids |
| mutation | `donors` | Count setting the stick's height |
| mutation | `consequence` | Colour and filter grouping |
| mutation | `impact` | Colour and filter grouping |
| protein domain | `id` | Identity |
| protein domain | `start`, `end` | Extent on the protein |
| protein domain | `description` | Label |

`x` plays `proteinPosStart`'s part. **`donors` is a count per mutation rather than a document field**, so a catalogue would supply it through an aggregation, which a field-to-concept mapping alone does not express. The protein's length is a constructor argument, `domainWidth`, rather than a data field.

**`oncojs/survivalplot`** (`@oncojs/survivalplot` `0.8.3` with its React wrapper, **no licence at all**, last commit 2019) has no equivalent in cBioPortal's extracted set. If survival curves are wanted, this is the only candidate found so far. NCI's GDC frontend already carries a D3 7 port of it, `@nci-gdc/survivalplot` inside `NCI-GDC/gdc-frontend-framework`, which bears on modernizing versus rewriting. The missing licence needs fixing before any reuse, the same gap already tracked in `.dev/tech-debt.md` for Arranger's own unlicensed packages.

## What a catalogue's mapping config would need to say

Not designed yet, sketched only: something shaped like a list of `{ concept: 'mutation.proteinChange', field: '<catalogue's own field name>' }` pairs, scoped per catalogue, alongside the existing field metadata rather than replacing it. `get_catalogue_fields` (or a dedicated introspection surface) would need to expose whichever mappings are configured, so a consumer can tell whether a catalogue supports a given visualization at all before trying to render it, the same way it already reports `isArray` so a consumer doesn't have to guess.

## Open questions

- Where the mapping config is declared: extended-mapping-adjacent configuration in `modules/graphql-router`, versus something new in `apps/mcp-server`. The data lives in the former; the consumer (`cre-ui`, through the MCP host) reaches it through the latter.
- Whether mapping is opt-in per catalogue (most likely) or something the admin UI surfaces as a guided setup.
- Whether this needs its own MCP tool/resource, or rides on an extended `get_catalogue_fields` response.
- `react-mutation-mapper`, `oncogrid` and `lolliplot` have confirmed data shapes and `oncoprintjs` a partial one. `cbioportal-frontend-commons`'s exports, and whether `oncogrid`/`lolliplot` are worth modernizing versus rewriting, are open, tracked in the atlas doc rather than guessed at here. Any further candidate needs the same direct verification before being added to this doc.
- How a mapping expresses a concept that is an aggregate rather than a field, such as `lolliplot`'s per-mutation `donors` count.
