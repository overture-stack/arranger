import { zodToJsonSchema } from 'zod-to-json-schema';

import {
	AllFilterSchema,
	BetweenFilterSchema,
	InLikeFilterSchema,
	RangeLikeFilterSchema,
	SqonGroupSchema,
	SqonLeafSchema,
	SqonSchema,
	WildcardFilterSchema,
} from '../schema/index.js';
import { SQON_SCHEMA_VERSION } from '../version/index.js';

import { draft202012Uri, schemaId } from './constants.js';
import type { JsonSchemaObject, SqonJsonSchema, VersionedSqonJsonSchema } from './types.js';

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

const buildRawSqonJsonSchema = () =>
	zodToJsonSchema(SqonSchema, {
		$refStrategy: 'root',
		definitionPath: '$defs',
		definitions: {
			All: AllFilterSchema,
			Between: BetweenFilterSchema,
			Wildcard: WildcardFilterSchema,
			Group: SqonGroupSchema,
			InLike: InLikeFilterSchema,
			Leaf: SqonLeafSchema,
			RangeLike: RangeLikeFilterSchema,
		},
		name: 'SQON',
		target: 'jsonSchema2019-09',
	});

export const getSqonJsonSchema = (): SqonJsonSchema => {
	const rawSchema = normalizeUnionKeywords(buildRawSqonJsonSchema()) as JsonSchemaObject;
	const defs = { ...(rawSchema.$defs || rawSchema.definitions || {}) } as Record<string, unknown>;

	delete rawSchema.definitions;

	defs.SQON = {
		oneOf: [{ $ref: '#/$defs/Group' }, { $ref: '#/$defs/Leaf' }],
	};

	return {
		...rawSchema,
		$schema: draft202012Uri,
		$id: schemaId,
		$ref: '#/$defs/SQON',
		$defs: defs,
		description: 'JSON Schema for Serialized Query Object Notation.',
		title: 'Serialized Query Object Notation',
	} as SqonJsonSchema;
};

export const getVersionedSqonJsonSchema = (): VersionedSqonJsonSchema => ({
	...getSqonJsonSchema(),
	version: SQON_SCHEMA_VERSION,
});
