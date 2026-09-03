import { z as zod } from 'zod';

import {
	AllFilterSchema,
	BetweenFilterSchema,
	InLikeFilterSchema,
	RangeLikeFilterSchema,
	SqonCombinationNodeSchema,
	SqonLeafSchema,
	SqonNodeSchema,
	WildcardFilterSchema,
} from '../schema/index.js';
import { SQON_SCHEMA_VERSION } from '../version/index.js';

import { draft202012Uri, schemaId } from './constants.js';
import type { JsonSchemaObject, SqonJsonSchema, VersionedSqonJsonSchema } from './types.js';

/**
 * The published `$defs` entries. Registering a schema makes `toJSONSchema` emit a `$ref` to its
 * entry root rather than inlining it, which is why no pointer ever runs through an `anyOf` segment.
 */
// Registers the unguarded schemas: this describes the data shape, and the depth guard's pipe has
// no JSON Schema representation, so registering it emits a broken `$ref` indirection instead.
const sqonSchemaRegistry = zod.registry<{ id: string }>();

sqonSchemaRegistry.add(AllFilterSchema, { id: 'All' });
sqonSchemaRegistry.add(BetweenFilterSchema, { id: 'Between' });
sqonSchemaRegistry.add(WildcardFilterSchema, { id: 'Wildcard' });
sqonSchemaRegistry.add(SqonCombinationNodeSchema, { id: 'Group' });
sqonSchemaRegistry.add(InLikeFilterSchema, { id: 'InLike' });
sqonSchemaRegistry.add(SqonLeafSchema, { id: 'Leaf' });
sqonSchemaRegistry.add(RangeLikeFilterSchema, { id: 'RangeLike' });
sqonSchemaRegistry.add(SqonNodeSchema, { id: 'SQON' });

/**
 * Zod emits `anyOf`; this schema has published `oneOf` since it shipped. Every union here is
 * disjoint, so both accept identical documents and the rename is behaviour-preserving. See the
 * tech-debt entry for why `anyOf` is the safer long-run choice.
 */
const normalizeUnionKeywords = (value: unknown): unknown => {
	if (Array.isArray(value)) {
		return value.map(normalizeUnionKeywords);
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	const record = Object.fromEntries(
		Object.entries(value).map(([key, childValue]) => [key, normalizeUnionKeywords(childValue)]),
	) as JsonSchemaObject;

	if (Array.isArray(record.anyOf) && !record.oneOf) {
		record.oneOf = record.anyOf;
		delete record.anyOf;
	}

	return record;
};

/**
 * `toJSONSchema` stamps each entry with its own `$schema` and `$id`, correct for a standalone
 * document but wrong for a subschema, so both are dropped in favour of the document's root pair.
 */
const buildSqonJsonSchemaDefs = (): Record<string, unknown> => {
	const { schemas } = zod.toJSONSchema(sqonSchemaRegistry, { uri: (id) => `#/$defs/${id}` });

	return Object.fromEntries(
		Object.entries(schemas).map(([name, schema]) => {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured to omit
			const { $schema, $id, ...rest } = schema as JsonSchemaObject;

			return [name, normalizeUnionKeywords(rest)];
		}),
	);
};

export const getSqonJsonSchema = (): SqonJsonSchema =>
	({
		$schema: draft202012Uri,
		$id: schemaId,
		$ref: '#/$defs/SQON',
		$defs: buildSqonJsonSchemaDefs(),
		description: 'JSON Schema for Serialized Query Object Notation.',
		title: 'Serialized Query Object Notation',
	}) as SqonJsonSchema;

export const getVersionedSqonJsonSchema = (): VersionedSqonJsonSchema => ({
	...getSqonJsonSchema(),
	version: SQON_SCHEMA_VERSION,
});
