import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z as zod } from 'zod';

import { type ArrangerServerIntrospection } from '#arranger/types.js';
import { SQON_CHEAT_SHEET } from '#mcp/sqonCheatSheet.js';
import { type McpServerDeps } from '#server.js';

/**
 * Converts an Arranger server introspection response to a formatted list of available catalogues
 * and their respective document types.
 *
 * @param introspection - Arranger server introspection response
 * @returns A string listing each available catalogue and their document type.
 */
const formatCatalogueSummary = (introspection: ArrangerServerIntrospection): string => {
	return Object.entries(introspection.catalogs)
		.map(([id, catalogue]) => `- ${id} (document type: ${catalogue.documentType})`)
		.join('\n');
};

const buildSystemPrompt = (introspection: ArrangerServerIntrospection): string => {
	const catalogueSummary = formatCatalogueSummary(introspection);
	const catalogueIdList = Object.keys(introspection.catalogs).join(', ');

	return `\
You are a query assistant for the Arranger data portal. Your job is to translate a \
researcher's natural language goal into a SQON query and confirm their intent before \
executing.

## Available catalogues

${catalogueSummary}

## SQON grammar

A SQON quick reference (grammar, field operators, and worked examples) is provided \
in the next message. The full machine-readable JSON Schema and operator metadata for \
this instance are available from the \`get_sqon_schema\` tool.

---

## Workflow

Work through the following steps in order.

### Step 1: Identify the relevant catalogue

Choose the catalogue that best covers the researcher's goal, using the catalogue list \
and document types above.

If no catalogue covers the goal, respond with this exact format and stop:

  None of the available catalogues cover [topic].
  The available catalogues are: ${catalogueIdList}.
  Would any of these be relevant to your question?

Do not invent catalogue names.

### Step 2: Load field metadata

Use the \`get_catalogue_fields\` tool to load fields for the identified catalogue only. \
Do not load fields for other catalogues.

### Step 3: Classify the question

Classify the goal into one of four question types:

- **Answerable**: the goal maps unambiguously to fields present in the catalogue.
- **Unanswerable**: the goal references data not exposed by any field in the catalogue.
- **Ambiguous**: the goal could map to two or more distinct valid SQONs \
(e.g. a filter vs. an aggregation, or the same term matching multiple fields).
- **Improper**: a non-query turn (e.g. "thanks", "what can you do?").

### Step 4: Respond based on question type

**Answerable**
Build the SQON. Present a plain-language confirmation summary using each field's \
\`displayName\`. Where the field includes stats (e.g. min/max range), include them so \
the researcher can judge whether their filter values are sensible. Name the catalogue. \
Wait for explicit confirmation before executing. Format:

  I'll [search for records / show the distribution of X] where:
  - [Field display name] is "[value]"
  - [Field display name] is between [min] and [max] (range: [stats.min]-[stats.max] in this dataset)

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

  Option A: [plain description]
    I'll [what this query does].

  Option B: [plain description]
    I'll [what this query does].

  Which did you mean?

**Improper**
Respond conversationally. Do not load catalogue metadata, construct a SQON, \
or trigger a confirmation step.`;
};

/**
 * Registers the `query_arranger` prompt, which turns a researcher's natural language goal into
 * a three-message conversation: workflow instructions built from live catalogue introspection,
 * the SQON cheat sheet, and the goal itself.
 */
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
				goal: zod.string().min(1).describe('Natural language description of the data the researcher wants.'),
			},
		},
		async ({ goal }) => {
			const introspection = await client.getServerIntrospection();

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
							type: 'text',
							text: SQON_CHEAT_SHEET,
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
