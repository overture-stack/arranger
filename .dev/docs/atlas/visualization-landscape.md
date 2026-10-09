# Genomics visualization libraries: a research record

Written for whoever specializes in this next. Scope: candidate visualization libraries for rendering Arranger data (OncoPrint-style grids, mutation lollipop plots, survival curves) through the MCP host's eventual notebook UI (`cre-ui`). Not in scope here: the cBioPortal MCP-server integration itself, or the host's broader connection-authentication design, both covered in [`arranger-auth/mcp-host-connections.md`](../arranger-auth/mcp-host-connections.md) §4. The compressed plan this research feeds is [`visualization-data-mapping.md`](../visualization-data-mapping.md); this document is the reasoning, the alternatives, and the parts of the investigation that didn't make it into the compressed version.

## Why this exists at all

`get_catalogue_fields` reports `displayName`, `isArray`, `type`, `unit` per field, all of it generic. No part of Arranger's catalogue configuration today says a field means "chromosome" or "protein change" in a domain sense. Any visualization library with a fixed expected data shape needs that gap closed with a per-catalogue mapping. The candidates below were evaluated specifically on whether they're pluggable with foreign data (a precondition for mapping onto Arranger's fields) or tightly bound to their origin's own backend.

## cBioPortal-originated libraries

cBioPortal publishes several of its own frontend's visualization components as standalone npm packages, separate from the full web app (which stays tightly bound to `cbioportal-ts-api-client` and their ClickHouse-backed REST API).

### `oncoprintjs`

- npm `6.1.6`, licence ISC (no reuse friction at all).
- Source moved into the `cbioportal-frontend` monorepo in 2022; the standalone `cBioPortal/oncoprintjs` repo is archived.
- Its own README states the model in one sentence: "a grid of `m` tracks of `n` types, where each element can either be a discrete value represented by a colored glyph on a grey background or a continuous value within a color range." No network calls described or implied anywhere in the docs.
- **Not fully verified.** The README says in its own words that "a full documentation of the API is still pending" and points at the compiled `dist/js/oncoprint.d.ts` instead. Neither the archived repository nor the monorepo documents the track-spec/data-item fields. Whoever implements against this needs to read `oncoprint.d.ts` directly, not infer a schema from this document or from `visualization-data-mapping.md`'s conceptual description.

### `react-mutation-mapper`

- npm `0.9.13`, described by its own maintainers as "Generic Mutation Mapper". Licence **AGPL-3.0-or-later**.
- Confirmed backend-agnostic by reading an actual usage example: `LollipopMutationPlot` takes a `store` built from `DefaultMutationMapperStore`, initialized with a callback that returns plain mutation objects, no live cBioPortal connection anywhere in the pattern.
- Confirmed the complete `Mutation` type, read from the type's source file (`cbioportal-utils/src/model/Mutation.ts`): 14 fields, full list in [`visualization-data-mapping.md`](../visualization-data-mapping.md)'s table. Only `proteinChange` and `proteinPosStart` are required; the rest sharpen the render rather than gate it.
- Licence note: the actual consumer is the MCP host's notebook UI (`cre-ui`), a separate app whose own licence isn't settled, not Arranger itself. AGPL's network-use clause reads differently for code bundled into a browser than for a server-side dependency, which `.dev/tech-debt.md`'s own AGPL entry already notes. Whether this is a fit is for whoever approves `cre-ui`'s dependencies to judge, not something this doc can conclude.

### `cbioportal-frontend-commons`

- npm `0.6.9`, "cBioPortal Frontend Modules". Noted as existing (likely a shared-utility dependency of the above two) but its actual exports were not inventoried. Open item for whoever picks this up.

## `oncojs` (OICR/softeng's own prior work)

All nine repos under the `oncojs` GitHub org were surveyed, not just the genomics-specific three, as they stood on 2026-10-09. Activity is each repo's default-branch head. The org listing's last-pushed dates come from Dependabot branches and say nothing about the code. Versions are the published npm packages, because the root manifests of `lolliplot` and `survivalplot` belong to a workspace and a demo app. Licensing comes from both the manifest and the licence file, because the two disagree in places.

| Repo | Purpose | Published as | Licence | Core deps | Last commit |
|---|---|---|---|---|---|
| `oncogrid` | OncoGrid (≈ `oncoprintjs` equivalent) | `oncogrid` 3.0.0, unscoped | **ambiguous**: manifest MIT, licence file Apache-2.0 | `d3@3.5.17` | 2018-12-12 |
| `lolliplot` | Mutation lollipop chart (≈ `react-mutation-mapper` equivalent) | `@oncojs/lolliplot` 0.10.2, `@oncojs/react-lolliplot` 0.11.9 | Apache-2.0 file; the packages declare none | `react@^15.4.1`, `redux@^3`, `react-faux-dom@^3`; D3 3 or 4 supplied by the caller | 2020-02-28 |
| `survivalplot` | Survival curves: **no cBioPortal-extracted equivalent found**, a new capability | `@oncojs/survivalplot` 0.8.3, `@oncojs/react-survivalplot` 0.6.0 | **none** | `d3@3` | 2019-07-03 |
| `boxplot` | Generic box plot | `@oncojs/boxplot` 0.3.1 | manifest MIT, no licence file | `d3-axis@1`, `d3-scale@3`, `d3-selection@1.4`, `styled-components@4.2` | 2019-08-15 |
| `qqplot` | Generic Q-Q plot | `@oncojs/qqplot` 0.0.1 | manifest MIT, no licence file | `d3@4.8.0`, `react@16.8.0`, `react-faux-dom@3.1.0` | 2019-11-19 |
| `sapien` | "Cases by Primary Site" human-body diagram, bucket-shaped data with configurable key names | `@oncojs/sapien` 0.5.3, `@oncojs/react-sapien` 0.5.2 | Apache-2.0 file; the packages declare none | `d3@^4.4.1`, `react@^15.4.2` | 2019-12-02 |
| `pathwayviewer` | Reactome pathway visualization | `@oncojs/pathwayviewer` 0.3.4 | **none** | `d3@3` and `jquery@3` as peers | 2017-08-04 |
| `platform` | Faceted-search UI components (Blueprint.js-based), not charts | not published | **none** | `@blueprintjs/*@1.x`, `react@^15.6.1` | 2017-08-01 |
| `integration-tests` | Cucumber step boilerplate | not published | MIT | not checked | 2017-10-05 |

**No repo has had a commit since February 2020, but the dependencies are not equally old.** The genomics-specific packages (`oncogrid`, `lolliplot`, `survivalplot`, `sapien`) sit on D3 v3/v4 and React 15, roughly a decade behind current. The generic statistical charts are newer underneath: `boxplot` on modular D3 sub-packages (the post-v4 architecture) and React 16, `qqplot` on D3 4 and React 16. `pathwayviewer` and `platform` are the oldest and least viable, both from 2017 with no modern tooling at all. Read this as "check each candidate's own dependencies," not "the whole org is equally dated."

**No Overture repository depends on oncojs.** A code search of the `overture-stack` org finds it only on the website, as a product entry. No commit since February 2020, and no Overture dependent found. Overture's live charting is `modules/charts`. The one active external user found is NCI's GDC frontend, `NCI-GDC/gdc-frontend-framework`. It carries its own copies of `sapien` and `survivalplot` in its `packages/` directory, as `@nci-gdc/sapien` and `@nci-gdc/survivalplot`, ported to D3 7 and last changed 2026-06-16, and it still lists `@oncojs/survivalplot` as a devDependency. ICGC's `dcc-portal`, last pushed 2023-10, also declares `@oncojs` packages.

**`oncogrid`'s data model is already minimal and config-driven**, confirmed from its `API.md` (fetched directly, not inferred from the README's pointer to it): donor objects need only `id`, gene objects need only `id`, observation/mutation objects need `id`, `geneId`, `donorId`. Everything else, including clinical fields like `age` and `vitalStatus`, is optional and consumed through separate track configuration. This is, independently, the same "named concept slots plus per-catalogue configuration" shape proposed generically in `visualization-data-mapping.md`. That is evidence the pattern already works in practice, not just a reasonable-sounding idea.

**`lolliplot`'s data shape is in its source, not its docs.** The README describes `data` only as "an object containing an array of proteins and an array of mutations", and no type declaration exists, so the shape below is what the lolliplot repository's own source reads, rather than a published contract. Each mutation carries `id`, `x` (its position on the protein), `donors` (the count setting the stick's height), `consequence` and `impact`, the last two driving the colour and filter groupings. Each protein domain carries `id`, `start`, `end` and `description`. The caller passes its own `d3` (v3 or v4) to the constructor, along with `domainWidth`, the protein's length in amino acids.

## Licensing, gathered in one place

| Package | Licence | Note |
|---|---|---|
| `oncoprintjs` | ISC | No friction |
| `react-mutation-mapper` | AGPL-3.0-or-later | Consumer is `cre-ui`, not Arranger; AGPL's network clause reads differently for browser-bundled code; for whoever approves `cre-ui`'s dependencies to judge |
| `oncogrid` | **Ambiguous** | The manifest says MIT and `LICENSE.txt` is Apache-2.0; settle which before reuse |
| `lolliplot`, `sapien` | Apache-2.0 | From each repository's licence file; the published packages declare none |
| `boxplot`, `qqplot` | MIT | Declared in the manifest only; no licence file |
| `survivalplot`, `pathwayviewer`, `platform` | **none declared** | Needs a licence added before any reuse or redistribution, the same class of gap already tracked in `.dev/tech-debt.md` for Arranger's own unlicensed packages. `survivalplot` already has a downstream copy, GDC's, which declares none either |

## What this doesn't settle

- Whether the eventual choice is "pick one source" or "mix": nothing here forces oncogrid-or-oncoprintjs as an exclusive pair. The OncoPrint-equivalent and the mutation-plot-equivalent could come from different sources if one side is meaningfully more viable than the other once someone actually opens the code.
- `oncoprintjs`'s real track/data-item schema (gated on reading its `.d.ts` directly, not documentation) and `cbioportal-frontend-commons`'s actual exports are unknown, not just unsummarized.
- Whether modernizing an `oncojs` package means a true rewrite or whether the D3/React core is small enough to re-platform while keeping the surrounding logic. Nobody has assessed `oncogrid`'s or `lolliplot`'s rendering code for that yet. For `sapien` and `survivalplot`, GDC's D3 7 copies are evidence that a re-platform is feasible.
- The mapping-config design questions in `visualization-data-mapping.md` (where it's declared, opt-in vs. guided, new tool vs. extended `get_catalogue_fields`) are unaffected by which library wins; they're upstream of this choice, not downstream of it.

## Related

- [`visualization-data-mapping.md`](../visualization-data-mapping.md): the compressed plan this feeds.
- [`mcp-host-plan.md`](../mcp-host-plan.md): the host architecture this slots into, `cre-ui` specifically.
- [`arranger-auth/mcp-host-connections.md`](../arranger-auth/mcp-host-connections.md): connection authentication for the host, a separate concern from data shape.
- `.dev/tech-debt.md`'s AGPL/unlicensed-package entries: the same missing-licence pattern found here in three `oncojs` repos.
