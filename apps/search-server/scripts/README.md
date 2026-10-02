# `apps/search-server/scripts`

Developer tools, run by hand. Not part of `build`, `start`, or `test`.

## `generateIntrospectionSqonFixtures.mts`

Regenerates the committed fixtures pinning the `GET /introspection/sqon` response.

### Why the fixtures exist

The endpoint is a published contract: REST clients read it, and the MCP Server returns it verbatim
from `get_sqon_schema`. Nothing in this repository validates data against the JSON Schema it carries,
and its most important consumer is an LLM reading it to learn how to write a SQON. These fixtures and
their tests are the only thing that notices when it moves.

### The files

All four sit in [`../src/introspection/`](../src/introspection), beside the endpoint they describe.

| File                                | What it is                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `introspectionSqon.schema.json`     | the SQON JSON Schema half of the response                                      |
| `introspectionSqon.metadata.json`   | the rest: `$schema`, `title`, `description`, `version`, `aliases`, `operators` |
| `introspectionSqonFixtures.ts`      | filenames, version placeholder, key sorting, fixture reader                    |
| `introspectionSqonFixtures.test.ts` | the four tests comparing the live response against the fixtures                |

Split in two on purpose: operator metadata and schema shape change for unrelated reasons, so neither
shows up as noise in the other's diff.

### When to run it

Not speculatively. **The failing test is the signal**: make your change, run
`npm test -w apps/search-server`, and regenerate if the fixture tests fail.

Expect that when you touch the inputs the response is built from:

- `modules/sqon/src/schema/`, the Zod schemas. New operators, renamed fields, and changed constraints
  all reach the emitted JSON Schema.
- `modules/sqon/src/operators/`, which becomes `aliases` and `operators`.
- `modules/sqon/src/jsonSchema/`, which builds the schema and sets `$id`.
- [`../src/introspection/sqonDetails.ts`](../src/introspection/sqonDetails.ts), the response envelope.
- `modules/sqon`'s `zod` or `zod-to-json-schema` versions. A dependency bump can move the output with
  no code change of ours, which is exactly what these fixtures exist to catch.

A release bumping only `SQON_SCHEMA_VERSION` is not a trigger: the version is placeholdered.

### Usage

```sh
npm run fixtures:introspection-sqon -w apps/search-server
```

No server, Elasticsearch, or network needed: `buildSqonDetails()` is a zero-argument pure function.

Then **read the `git diff`** and decide whether `SQON_SCHEMA_VERSION` (which is `modules/sqon`'s own
package version) needs a bump. Regenerating without reading defeats the point of having these files.

### Three properties the tests depend on

1. **Sorted keys**, so a reordering cannot swamp the diff and hide the real change.
2. **Version placeholder.** `$id` and `version` embed `SQON_SCHEMA_VERSION`, so the live value would
   rewrite the fixtures every release. The generator asserts how many occurrences it expects, so a new
   field carrying the version cannot slip in as a literal.
3. **Prettier formatting**, because the root `scripts/format-all.sh` sweeps `.json` and would silently
   reformat a non-canonical fixture, failing the tests for no real reason. `JSON.stringify` alone does
   not produce that form.

### Naming note

Not `introspectionSqon.envelope.json`: `.gitignore`'s `**/*.env*` dotenv rule also matches
`*.envelope.json`, which silently excludes the file from commits and from Prettier (which respects
`.gitignore` by default).
