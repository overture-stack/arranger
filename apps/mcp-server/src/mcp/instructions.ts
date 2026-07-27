/**
 * Server-level instructions returned in the MCP `initialize` response. Clients typically fold this
 * text into the model's system prompt, so it is the only guidance that reaches the model before it
 * decides which tool to call first. Tool descriptions arrive with the tool list and are read once a
 * tool is already under consideration; this text is what establishes the discovery-before-query
 * rule in the first place.
 *
 * It is deliberately static. Instructions are fixed at construction time (`createMcpServer` is
 * synchronous, one call per session in `createHttpApp`), so naming the live catalogues here would
 * mean an Arranger round trip per session, and would undercut the rule it exists to state: the
 * model should read catalogue names from `list_catalogues`, not from a prefix that may be stale.
 *
 * Keep it short. It is billed on every session, and it competes for attention with the host's own
 * system prompt. Anything longer or more procedural belongs in the `query_arranger` prompt, which
 * is opt-in per turn.
 */
export const SERVER_INSTRUCTIONS = `Arranger MCP server. This server exposes the data catalogues of one Overture Arranger instance, so you can search and summarize the records in them: filtered document searches (hits), per-field summaries (aggregations), or both.

A catalogue is one searchable collection of documents (files, participants, samples, and so on), with its own index and its own set of fields. Filters are written as SQON (Serializable Query Object Notation), Arranger's JSON filter format.

## Never guess

Catalogue names, field names, and SQON syntax are specific to the connected instance. They are not knowable in advance, and they differ between Arranger deployments. Do not recall them from another portal, from training data, or from an assumption made earlier in this conversation.

- Never invent or guess a catalogue name. Call \`list_catalogues\`.
- Never invent or guess a field name. Call \`get_catalogue_fields\` for the catalogue you are about to query.
- Never write a SQON filter from memory. Call \`get_sqon_schema\` before you construct your first SQON.

When a call fails because a name was wrong, re-read the metadata. Do not retry with variations of the name.

## Workflow

1. \`list_catalogues\`: find the catalogue that covers the user's goal. If none does, say so and list what is available rather than substituting a catalogue that is merely adjacent to the goal.
2. \`get_catalogue_fields\` for that one catalogue: returns each field's dot-notation name, type, display name, and the SQON operators valid for that type. Use display names when talking to the user, field names when building the query.
3. \`get_sqon_schema\`: the SQON grammar, operators, and worked examples.
4. \`execute_query\`: pass the catalogue ID, the SQON, and the fields or aggregation fields you need.

If the goal maps to more than one plausible query, ask which was meant instead of silently choosing. If it needs data that no field in the catalogue holds, say so and name the closest available fields; do not approximate with an unrelated field.

## Notes

- \`execute_query\` validates the SQON, every field name, and every operator against the catalogue before anything reaches Arranger, and reports the specific problem when it rejects a call. Treat a rejection as a signal to re-read the field metadata, not to resend the same shape.
- Where the client supports elicitation, the user is shown the generated GraphQL query and asked to confirm before it runs. Where it does not, nothing prompts them, so confirm intent in conversation before executing.
- The \`query_arranger\` prompt carries a fuller version of this workflow with the SQON grammar inline, and is the better entry point for a natural language search when the client supports prompts. On that path the grammar is already in context, so step 3 above is satisfied without the tool call.
- The same metadata is also readable as resources under \`arranger://introspection/\`, for clients that prefer resources to tool calls.`;
