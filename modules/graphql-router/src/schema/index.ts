import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { applyMiddleware } from 'graphql-middleware';

import type { ArrangerBaseContext, GraphQLEndpointMiddleware } from '#types.js';

import { resolvers as generateResolvers, typeDefs as generateTypeDefs } from './Root.js';
import type { SchemaTypesTuple } from './types.js';

export const setsMapping = {
	userId: { type: 'keyword' },
	sqon: { type: 'object' },
	ids: { type: 'keyword' },
	setId: { type: 'keyword' },
	type: { type: 'keyword' },
	path: { type: 'keyword' },
	size: { type: 'long' },
	createdAt: { type: 'date' },
};

/**
 * Create the sets type to combine with the catalog document type to create the complete schema.
 * Types are of the shape `[ 'documentName', {config, mapping, index, etc.}]`
 * The Sets type is only dependent on the `setsIndex`, which is the string name of the index in the
 * search engine that will store sets.
 */
export const createSetsType = (setsIndex: string): SchemaTypesTuple => {
	return [
		'sets',
		{
			index: setsIndex,
			name: 'sets',
			createState: false,
			nestedFieldNames: [],
			nested_fieldNames: [],
			indexPrefix: '',
			customFields: '',
			extendedFields: [
				{
					displayName: 'ids',
					fieldName: 'ids',
					isActive: false,
					isArray: true,
					type: 'keyword',
					unit: null,
				},
			],
			mapping: setsMapping,
		},
	];
};

export const createCatalogResolvers = <Context extends ArrangerBaseContext>({
	debug = false,
	enableAdmin = false,
	getServerSideFilter,
	rootTypes = [],
	scalarTypes = [],
	setsIndex,
	types, // ['documentName', {configs, mapping, index, etc..}]
}: {
	debug?: boolean;
	enableAdmin?: boolean;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	rootTypes?: any[];
	scalarTypes?: any[];
	setsIndex: string;
	types: SchemaTypesTuple;
}) => {
	const typesWithSets = [types, createSetsType(setsIndex)];

	const resolvers = generateResolvers<Context>({
		debug,
		enableAdmin,
		getServerSideFilter,
		rootTypes,
		scalarTypes,
		setsIndex,
		types: typesWithSets,
	});

	return { typesWithSets, resolvers };
};

export const createSchemaForResolvers = ({
	middleware = [],
	mock = false,
	resolvers,
	rootTypes = [],
	scalarTypes = [],
	typesWithSets,
}: {
	middleware?: GraphQLEndpointMiddleware[];
	mock?: boolean;
	resolvers: any;
	rootTypes?: any[];
	scalarTypes?: any[];
	typesWithSets: SchemaTypesTuple[];
}) => {
	const typeDefs = generateTypeDefs({
		rootTypes,
		scalarTypes,
		types: typesWithSets,
	});

	const schema = makeExecutableSchema({
		typeDefs,
		resolvers,
		resolverValidationOptions: {
			// this disables a warning which we are ok with (https://github.com/prisma/prisma/issues/2225)
			requireResolversForResolveType: 'ignore',
		},
	});

	if (mock) {
		addMocksToSchema({
			schema,
			mocks: { JSON: () => JSON.stringify({ key: 'value' }) },
		});
	}

	return applyMiddleware(schema, ...middleware);
};
