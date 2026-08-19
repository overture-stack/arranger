# modules/components modernization

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entries. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Components module modernization

_Priority: medium-high for the `recompose` removal specifically; medium for the rest. Confirmed compatibility risk, not just a style concern._

The components package still uses patterns that predate React hooks: `recompose` (an HOC composition library), `component-component` (a render-prop state machine), and class-based components throughout. These are no longer idiomatic React and make the codebase harder to read, test, and extend.

**`recompose` is a confirmed, not just theoretical, compatibility risk.** It's abandoned (`0.30.0`, last published 2023-03-03, no updates since) and calls `React.createFactory()` internally. That function was deprecated in React 16.9 and is **removed entirely** in React 19 (confirmed against React's own official upgrade guide: "React.createFactory is no longer exported"), not merely warned about. `package.json`'s `peerDependencies` already advertises `"react": "^17.0.0 || ^18.0.0 || ^19.0.0"`; any consumer that actually upgrades to React 19 today would hit a hard crash in every one of the 4 files below, despite the peer range claiming support. Removing `recompose` specifically (not the other two patterns) is what closes this gap.

**Confirmed scope, by grep:**

- `recompose`: 4 files (`Tabs.jsx`, `Query.jsx`, `QuickSearch/QuickSearchQuery.js`, `Arranger/MatchBox.jsx`).
- `component-component`: 10 files, concentrated in one directory; 7 of the 10 are in `AdvancedSqonBuilder/` (`index.jsx`, `SqonEntry.js`, `sqonPieces/FieldOp.jsx`, `sqonPieces/BooleanOp.jsx`, `filterComponents/BooleanFilter.jsx`, `filterComponents/RangeFilter.js`, `filterComponents/TermFilter.jsx`); the rest are `AdvancedFacetView/index.jsx`, `State.js`, and `utils/ExtendedMappingProvider.jsx`. Migrating `AdvancedSqonBuilder` alone closes most of this.
- Class components: 21 files. Not confined to obviously-legacy code: alongside `Query.jsx`, `State.js`, and `AdvancedFacetView/*`, the pattern also cuts through the theme engine (`ThemeContext/index.tsx`, `Table/helpers/context.tsx`, `DataContext/index.tsx`) and the Aggs family (`aggregations/RangeAgg.jsx`, `aggregations/DatesAgg.jsx`, `aggregations/AggsState.ts`); code that's otherwise already modernized in other respects.

Scope:

- Remove `recompose` and `component-component`; replace HOC and render-prop patterns with hooks
- Convert remaining class components to function components
- Simplify the aggregations components, which have accumulated redundant abstractions over time (multiple layers of HOC wrapping that add indirection without adding value)

Can be done incrementally, component by component, without breaking the public API. `AdvancedSqonBuilder` is the natural first target for `component-component` removal, given how concentrated that dependency is there.

---

## Extend the theming engine to all components

_Priority: medium. Consistency issue that affects integrators._

The table component introduced a theming system (`modules/components/src/ThemeContext/`: `ThemeProvider`, `useThemeContext`, `withTheme`, and a `Components` type holding a per-component theme shape) that lets operators customize appearance through a theme prop. Most aggregation components already participate: `TermAggs`, `BooleanAggs`, `AggsGroup`, `BucketCount`, `RangeAgg`, and `DatesAgg` are wired in. The remaining gaps are narrower than "facets and aggregation components" suggests: `Aggregations.jsx`, `AggsQuery.jsx`, `aggComponentsMap.jsx`, `AggsPanel.jsx`, `TermAggs/SelectAllButton.jsx`, and `Tooltip/`.

**Next concrete target: Tooltip.** `modules/components/src/Tooltip/` already carries its own local theme prop (`TooltipThemeProperties`: `tooltipAlign`, `tooltipFontColor`, `tooltipText`, `tooltipVisibility`), but it is a self-contained shape disconnected from the central `Components` type. Folding it in (add a `Tooltip: TooltipThemeProps` slot to `Components`, switch the component to `useThemeContext`/`withTheme`) follows the exact pattern Table and Aggregations already use. It does not require the Emotion replacement decision below: it reuses the existing mechanism rather than deepening investment in it, so it is a reasonable next step to take now.

**Known unaddressed split:** `modules/charts` has its own separate `ChartsThemeProvider` (colour array, a `components` override slot including `TooltipComp`/`Loader`) with no connection to `modules/components`' `ThemeContext`. Whether these should ever merge is an open question, not yet scoped. Note `TooltipComp` specifically is declared but not actually wired up yet, see [tech-debt: `TooltipComp` theme override is declared but never wired up](tech-debt.md#tooltipcomp-theme-override-is-declared-but-never-wired-up).

_Coordinate with the Emotion replacement (decided: ShadCN/Base UI + `cva`, see below) before investing heavily beyond the Tooltip step; the styling mechanism affects how theming is implemented for anything larger._

---

## Replace Emotion with a less constrained styling solution

_Priority: medium-high. Decided 2026-08-04: ShadCN, on Base UI, with `cva` for variant styling. Blocks or complicates several other component improvements until implemented._

Emotion is the current CSS-in-JS library. It ties the build to Babel and has known caching issues in some environments. Confirmed footprint: 46 files in the module import from `@emotion/*`, essentially the entire styled-component surface and not a contained corner of it, with 39 files using the `css` template-literal prop and 6 using `styled(...)`. This is a module-wide migration, not a localized swap.

**Decision:** ShadCN with Tailwind CSS, using [`cva`](https://cva.style) (class-variance-authority) to author variant-driven component APIs. Adopted from research already done in another Overture project. As of shadcn's July 2026 changelog, Base UI (not Radix) is shadcn's default primitive layer: built by the same team behind Radix, at `@base-ui/react@1.6.0`, with new projects created via `shadcn/create` picking it over Radix roughly 2 to 1, and it ships primitives Radix never had (Combobox, Autocomplete, Number Field, Checkbox Group, object-valued Select). Radix itself is not deprecated (shadcn ships every update for both libraries), so this is a "faster-moving option from the same lineage" choice, not an abandoned-library workaround.

A proof-of-concept with one or two components is still recommended before the full migration, to validate the component API and theming model shift in practice.

_This decision gates the theming extension work below, which is now unblocked to proceed against ShadCN/Base UI's theming model once the proof-of-concept lands._

---

## Storybook (or similar) for `modules/components`/`modules/charts`, carrying their own integration tests

_Priority: medium. Confirmed real gap: no test today exercises "server builds a schema this way" through to "the UI queries and renders it correctly."_

There is currently no integration testing between the UI packages and a real running `search-server`. `integration-tests/import` is a pure module-resolution smoke test (checks exports are `defined`, nothing functional). `integration-tests/server` is real ES + real `search-server`, but entirely server-side, no UI/component involvement. `modules/components`' own Jest suite is unit-level and thin (per the Components modernization section above and existing tech-debt entries), mostly pure-function tests, not full rendering against real data.

This gap let a real cross-package mismatch ship unnoticed during this session's GraphQL name sanitization work: the UI packages had their own independent, duplicated copies of the raw-to-GraphQL-name transform (`LiveAdvancedFacetView.js`, `Aggregations.jsx`, `Stats.jsx`, `charts/arranger/mapping.ts`, and others), each only handling dots, none aware of the server's fuller sanitization. Only caught by reasoning through it by hand, not by any test.

Storybook (or an equivalent tool) would give `modules/components`/`modules/charts` a place to run against realistic, representative data shapes (including edge cases like unusual field names) with visual/interaction assertions, closing the gap between "package imports without crashing" and "actually renders correct results for real server responses."

**Corrected 2026-08-17, the scope here is not greenfield.** Storybook already exists in both packages, in two different broken states, which changes the cost estimate in opposite directions:

- **`modules/charts` has a complete, modern, empty harness.** Storybook 9 (`@storybook/react-vite`), a four-file `.storybook/` directory with decorators and preview, and both `storybook` and `build:storybook` scripts. Zero `*.stories.*` files. This half needs stories written, not infrastructure, and is unblocked today.
- **`modules/components` has a dead 2018 relic.** `@storybook/react@^3.3.3` with a `.storybook/config.js` using the removed `configure()` API, last touched 2019-12-24, and no `storybook` script so nothing can launch it. It also has 11 orphaned story files under `stories/` that nobody can currently see, which are the only surviving record of how these components were meant to be composed. That install is separately the source of 42 of the repo's 45 `npm audit` criticals (see [tech-debt](tech-debt.md#a-dead-2018-storybook-install-in-modulescomponents-is-the-source-of-42-of-the-repos-45-npm-audit-criticals)), so removing it is worth doing on security grounds regardless of what replaces it.

Split accordingly: (a) write stories against charts' existing setup, then add interaction assertions; (b) delete the Storybook 3 install from components, triage the 11 legacy stories, and only then decide between Storybook 9 and plain `jsdom` + `@testing-library/react`.

---
