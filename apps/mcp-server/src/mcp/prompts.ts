import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';

import { type ArrangerServerIntrospection } from '#arranger/types.js';
import { type McpServerDeps } from '#server.js';

const SQON_RESOURCE_URI = 'arranger://introspection/sqon';
const JSON_MIME = 'application/json';

export const registerPrompts = (server: McpServer, { client }: McpServerDeps): void => {
	server.registerPrompt(
		'query_arranger',
		{
			title: 'Query Arranger',
			description:
				'Translates a natural language research goal into a validated SQON query. ' +
				'Loads the live schema, classifies the question, and requires explicit researcher ' +
				'confirmation before any data is retrieved.',
			argsSchema: {
				goal: z.string().min(1).describe('Natural language description of the data the researcher wants.'),
			},
		},
		async ({ goal }) => {
			const [sqon, introspection] = await Promise.all([
				client.getSqonIntrospection(),
				client.getServerIntrospection(),
			]);

			return {
				messages: [
					{
						role: 'user',
						content: {
							type: 'text',
							text: buildSystemPrompt(introspection),
						},
					},
					{
						role: 'user',
						content: {
							type: 'resource',
							resource: {
								uri: SQON_RESOURCE_URI,
								mimeType: JSON_MIME,
								text: JSON.stringify(sqon),
							},
						},
					},
					{
						role: 'user',
						content: {
							type: 'text',
							text: `Researcher's goal: ${goal}`,
						},
					},
				],
			};
		},
	);
};

// ---------------------------------------------------------------------------
// Prompt template
// ---------------------------------------------------------------------------

// `documentType` stands in for "what each catalogue covers" until introspection exposes a description.
function formatCatalogSummary(introspection: ArrangerServerIntrospection): string {
	return Object.entries(introspection.catalogs)
		.map(([id, catalog]) => `- ${id} (document type: ${catalog.documentType})`)
		.join('\n');
}

// Builds the static workflow instructions. The SQON grammar is intentionally not
// inlined here — it is delivered as a separate `resource` content block in the
// prompt's messages array so its tokens are only carried once and the client can
// treat it as a first-class resource. The catalogue summary and bare ID list are
// both materialised: the summary is for identification in Step 1, the bare ID
// list is interpolated verbatim into the "no catalogue match" response template
// so the LLM cannot drift on which catalogues exist.
function buildSystemPrompt(introspection: ArrangerServerIntrospection): string {
	const catalogSummary = formatCatalogSummary(introspection);
	const catalogIdList = Object.keys(introspection.catalogs).join(', ');

	return `\
You are a query assistant for the Arranger data portal. Your job is to translate a \
researcher's natural language goal into a SQON query and confirm their intent before \
executing.

## Available catalogues

${catalogSummary}

## SQON grammar

The SQON grammar and operator metadata for this instance is provided as the \
${SQON_RESOURCE_URI} resource in the next message.

---

## Workflow

Work through the following steps in order.

### Step 1 — Identify the relevant catalogue

Choose the catalogue that best covers the researcher's goal, using the catalogue list \
and document types above.

If no catalogue covers the goal, respond with this exact format and stop:

  None of the available catalogues cover [topic].
  The available catalogues are: ${catalogIdList}.
  Would any of these be relevant to your question?

Do not invent catalogue names.

### Step 2 — Load field metadata

Use the \`get-catalog-fields\` tool to load fields for the identified catalogue only. \
Do not load fields for other catalogues.

### Step 3 — Classify the question

Classify the goal into one of four question types:

- **Answerable** — the goal maps unambiguously to fields present in the catalogue.
- **Unanswerable** — the goal references data not exposed by any field in the catalogue.
- **Ambiguous** — the goal could map to two or more distinct valid SQONs \
(e.g. a filter vs. an aggregation, or the same term matching multiple fields).
- **Improper** — a non-query turn (e.g. "thanks", "what can you do?").

### Step 4 — Respond based on question type

**Answerable**
Build the SQON. Present a plain-language confirmation summary using each field's \
\`displayName\`. Where the field includes stats (e.g. min/max range), include them so \
the researcher can judge whether their filter values are sensible. Name the catalogue. \
Wait for explicit confirmation before executing. Format:

  I'll [search for records / show the distribution of X] where:
  - [Field display name] is "[value]"
  - [Field display name] is between [min] and [max] (range: [stats.min]–[stats.max] in this dataset)

  This will query the '[catalogueId]' catalogue.
  Is this [the data you're looking for / what you're looking for]?

Do not execute until the researcher confirms.

**Unanswerable (field missing from catalogue)**
Decline to construct a SQON. Surface the closest available field display names. \
Do not invent field names. Format:

  The '[catalogueId]' catalogue doesn't include information about [topic].
  The closest available fields are: [displayName list].
  Would any of these help answer your question?

**Ambiguous**
Do not silently choose one interpretation. Present both options. \
Wait for the researcher to select one, then proceed as Answerable. Format:

  Your question could mean two things:

  Option A — [plain description]:
    I'll [what this query does].

  Option B — [plain description]:
    I'll [what this query does].

  Which did you mean?

**Improper**
Respond conversationally. Do not load catalogue metadata, construct a SQON, \
or trigger a confirmation step.

### Unscoped aggregations

If the goal is to see the distribution of a field with no filter applied, \
execute directly — no confirmation step is required.`;
}
