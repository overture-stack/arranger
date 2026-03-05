import { SQON_SCHEMA_VERSION } from './version.js';

const schemaId = `https://overture-stack.org/schemas/arranger/sqon/v${SQON_SCHEMA_VERSION}.schema.json`;

/**
 * Placeholder until zod-to-json-schema is wired in this workspace.
 * The endpoint shape can be implemented now while we finalize conversion tooling.
 */
export const getSqonJsonSchema = () => ({
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: schemaId,
	title: 'Serialized Query Object Notation',
	type: 'object',
	description: 'JSON Schema export pending zod-to-json-schema wiring.',
});

export const getVersionedSqonJsonSchema = () => ({
	...getSqonJsonSchema(),
	version: SQON_SCHEMA_VERSION,
});
