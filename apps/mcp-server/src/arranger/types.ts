import { z as zod } from 'zod';

export type {
	CatalogFieldIntrospection as ArrangerCatalogFieldDetails,
	CatalogIntrospectionResponse as ArrangerCatalogIntrospection,
	IntrospectionResponse as ArrangerServerIntrospection,
	SqonIntrospectionResponse as ArrangerSqonIntrospection,
} from '../../../search-server/src/introspection/types.js';

// TODO: as part of tech debt item "Introspection types should be Zod-first to allow reuse as MCP output schemas",
// these types should be replaced with exports from the search-server's Zod schemas once that work is done.

export const catalogsSchema = zod.record(
	zod.object({
		description: zod.string().optional(),
		documentType: zod.string(),
		paths: zod.object({
			fields: zod.string().optional(),
			graphql: zod.string(),
			introspection: zod.string(),
		}),
	}),
);

const sqonOperatorDetailSchema = zod.object({
	applicableTo: zod.union([zod.literal('all'), zod.array(zod.string())]),
	op: zod.string(),
	valueType: zod.string(),
});

export const sqonIntrospectionSchema = zod.object({
	$schema: zod.string(),
	aliases: zod.record(zod.string()),
	description: zod.string(),
	operators: zod.object({
		combination: zod.array(zod.string()),
		field: zod.array(sqonOperatorDetailSchema),
	}),
	schema: zod.record(zod.unknown()),
	title: zod.string(),
	version: zod.string(),
});

const fieldSchema = zod.object({
	displayName: zod.string(),
	type: zod.string(),
	unit: zod.string().nullable().optional(),
});

export const catalogIntrospectionSchema = zod.object({
	catalogId: zod.string(),
	description: zod.string().optional(),
	documentType: zod.string(),
	generatedAt: zod.string(),
	meta: zod.object({
		authFiltered: zod.boolean(),
	}),
	operators: zod.record(zod.array(zod.string())),
	fields: zod.record(fieldSchema),
});
