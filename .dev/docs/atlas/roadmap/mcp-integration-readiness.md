# MCP integration readiness

Detail layer for the [`MCP integration readiness`](../../../roadmap.md) roadmap entry. The roadmap carries the terse summary and current status; this file holds the reasoning, alternatives considered, prior art, and history. Split out 2026-08-18 under `roadmap_split: yes`.

---

Six targeted improvements to make Arranger a well-behaved upstream for an MCP server layer. The first three arose from reviewing the Arize text-to-graphql-mcp reference implementation against Arranger's current schema surface; the fourth addresses observed quality issues in MCP-driven SQON generation; the fifth is a follow-up question from a documentation fix logged during a downstream PR review; the sixth is the accumulated `/docs` gap the other five (and everything already shipped) have left behind. The fourth is now done; the other five remain open.

#### SQON generation via `build_sqon` tool [done]

_Shipped 2026-08-10 (#1080), version 1: the scalar operators (`in`, `not-in`, `gt`, `gte`, `lt`, `lte`, `between`) with one `and`/`or` combination per call. Text operators and mixed AND/OR nesting are deliberately deferred; see § Phasing in `.dev/docs/build-sqon-tool.md` for the v2/v3 shape. The design and implementation records are `.dev/docs/build-sqon-tool.md` and `.dev/docs/build-sqon-implementation.md`._

_Priority when open: high. Somewhat urgent: MCP SQON generation was hit-or-miss in practice._

LLMs asked to generate SQONs by inference produce inconsistent results. The root cause is training-data staleness: operator names, value schemas, combination nesting rules, and field-type constraints in model training data are incomplete or incorrect relative to the current spec. Prompting alone cannot reliably compensate for this.

The fix is to remove the LLM from the SQON synthesis loop. Add a `build_sqon` MCP tool in `apps/mcp-server` that accepts structured parameters (field, operator, value, and an optional combination operator for nesting) and calls `SqonBuilder` internally, returning a validated SQON. The LLM's responsibility becomes selecting the right field, operator, and value from the available catalogue schema, not synthesizing raw JSON. The tool is the generator; the LLM is the selector.

This is also more token-efficient than the alternatives: embedding SQON documentation in a system prompt and relying on the `/introspection` endpoint as a runtime SQON guide both consume context window on every request. A tool call is cheaper and fully deterministic.

**Scope, as built:**

1. **`build_sqon` tool** in `apps/mcp-server/src/mcp/buildSqonTool.ts`, registered from `mcp/tools.ts`: accepts a `catalogueId`, one `combination` (`and`/`or`), a list of `clauses` (`fieldName`, `operator`, `value`, optional `negate`), and an optional `existingSqon`; validates every clause against that catalogue's introspection; folds them with `addFilterClause`; returns the SQON with a plain-English `summary`, a submitted-versus-final clause count, and a note when the two differ. One call carries the whole batch: the originally-scoped one-clause-per-call shape was rejected during design, because a per-clause call turns an N-condition query into N round trips and makes a rejected clause N/2 calls of wasted work on average (see § Why one call builds a whole batch in `.dev/docs/build-sqon-tool.md`).
2. **Agent-optimized tool description** [done]: the operator descriptions are generated at module load from `getSqonFieldOperatorDetails()`, so they cannot drift from `modules/sqon`, and are attached per schema branch rather than once for all operators, which keeps the emitted JSON Schema roughly a third smaller than repeating the full list on every branch. The batch-level guidance sits on the `clauses` array, once.
3. **Versioned changelog** [not done]: the tool interface is not versioned and carries no machine-readable changelog. Version 1's operator coverage is described in the tool's own input schema, which is authoritative but not versioned. Revisit if and when a v2 changes the input shape rather than only extending it.

**Prerequisite (resolved):** the `build_sqon` tool's operator coverage is bounded by `SqonBuilder`'s. This was previously blocked on absorbing full operator coverage into `modules/sqon`; that absorption is now complete (see [Deprecate `sqon-builder`](#deprecate-sqon-builder)) and `modules/sqon`'s `SqonBuilder` already covers `all`, `between`, `gte`, `in`, `lte`, `not-in`, `some-not-in`, and `wildcard`. `build_sqon` can ship with full operator coverage from the start; no partial-coverage phasing is needed.

**Considered and deferred: TOON as output format.** [TOON (Token-Oriented Object Notation)](https://toonformat.dev) was evaluated as an optional compact output format, both for MCP responses (field listings, search results) and as a potential evolution of the SQON surface syntax itself. The MCP response case has genuine merit: TOON's tabular collapse applies well to uniform arrays like field listings. The SQON syntax case is weaker: SQON's recursive tree structure limits the tabular gains, and the `build_sqon` tool already removes the LLM from the synthesis loop, which was the main pain point. Revisit as an enhancement once the `execute_query` MCP implementation is available and real token budgets can be measured empirically.

#### Schema cache invalidation signal (ETag / schema hash)

_Priority: high._

An MCP server wrapping Arranger will cache the introspected schema to avoid re-fetching on every query. Arranger's schema is generated from ES/OS index mappings, which can change when indices are updated or reindexed. Without a cache invalidation signal, an MCP server has no way to know when its cached schema is stale; it will generate queries against a schema that no longer matches the live index, producing errors that are hard to diagnose.

Arranger should expose a schema hash or ETag on introspection responses (a response header is sufficient; no new endpoint needed) so MCP consumers can cheaply detect schema changes and re-fetch only when necessary. Extends naturally from the "API version exposure" work above, which already adds a version field to the introspection endpoint.

_Small Arranger change, high operational value for any MCP implementation. Coordinate with whoever is building the MCP server._

#### SQON documentation in schema descriptions

_Priority: medium._

Arranger's filter arguments accept SQON, but the generated schema types them as opaque input objects with no documentation of the expected structure. An LLM generating queries against the schema has no way to know what a valid SQON looks like from schema introspection alone; every MCP implementation has to embed SQON-specific system prompts as a workaround.

Adding a description to the filter argument input types explaining the SQON structure (content/combination operators, value types, nesting rules) would let the LLM infer the filter format directly from the schema. This reduces coupling between the MCP prompt layer and Arranger internals, and benefits GraphQL Playground users at the same time.

_See `docs/concepts.md` for the canonical SQON definition to base descriptions on._

#### Field descriptions in the generated schema

_Priority: medium._

The GraphQL schema Arranger generates from ES/OS index mappings currently carries no field descriptions, only raw field names. An LLM building queries against this schema must select fields by name alone, with no semantic context. The Arize reference implementation strips all schema descriptions to save tokens precisely because they tend to be noisy; Arranger's schema instead has none at all.

Arranger should surface field descriptions from ES mapping metadata (the `meta` object on a field mapping, which can carry arbitrary key-value pairs including a `description`) as GraphQL field descriptions. Where no metadata description exists, the field name is still the fallback. This gives LLM consumers (and Playground users) meaningful context at the point where it costs nothing to add it.

_Requires a mapping-to-schema pass change. Operators who want richer descriptions can add `meta.description` to their index mappings without any Arranger code change._

#### Make invisible query defaults visible via SDL (research)

_Priority: low. The documentation gap is closed (see `docs/reference/06-defaults-and-limits.md`); this is the follow-up question of whether the underlying defaults should also become schema-visible._

Several arguments that materially change query results (`hits(first)`, `aggregations.buckets(max)`, `histogram(interval)`, `range(ranges)`, `cardinality(precision_threshold)`, `top_hits(size)`, `include_missing`) default in resolver code rather than as GraphQL SDL argument defaults, unlike `hits(trackTotalHits: Boolean = true)`, which does have a real SDL default. A human reading the defaults-and-limits doc now has the answer, but an LLM or codegen tool working from the schema alone still doesn't. Worth revisiting once the SDL surface is being touched for other reasons anyway, for example alongside [SQON documentation in schema descriptions](#sqon-documentation-in-schema-descriptions) above: would adding real `= value` defaults to these arguments change resolver behaviour in any edge case (for instance, distinguishing "explicitly passed 10" from "omitted"), or is it a safe, additive schema change?

#### Update `/docs` for the MCP server surface

_Priority: medium. Recurring gap logged as a session open thread many times over; never yet promoted to a tracked item._

**Partly closed 2026-08-10.** `docs/usage/06-ai-and-automation.md` was promoted to a top-level `docs/mcp-server.md` (#1089), which now names all five tools with their input shapes, the call order, and `build_sqon`'s output contract. What is still missing is depth: each tool's full output shape, worked request/response examples, and the elicitation-confirmation flow in `execute_query`, which remains documented nowhere a reader of `/docs` will find it.

**Scope:**

- A dedicated `docs/reference/` page (or an extension of `mcp-server.md`) covering the full MCP tool surface: what each tool does, its input/output shape, and the elicitation-confirmation flow in `execute_query`.
- ~~To check once `build_sqon` ships: `docs/concepts.md`'s `fieldName`/`fieldNames` definition~~ done 2026-08-10: the definition now covers both positions, the `content` object and a flat clause-building argument, and the vocabulary table entry matches.

_Coordinate with whichever MCP work lands next; `execute_query` shipped in #1077 and `build_sqon` in #1080, both now named in `docs/mcp-server.md`._

---
