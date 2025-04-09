import { addMocksToSchema } from '@graphql-tools/mock';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { applyMiddleware } from 'graphql-middleware';

import { resolvers as generateResolvers, typeDefs as generateTypeDefs } from './Root.js';

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

const makeSchema = ({
	enableAdmin = false,
	enableDocumentHits = true,
	getServerSideFilter,
	middleware = [],
	mock = false,
	rootTypes = [],
	scalarTypes = [],
	setsIndex,
	types = [],
} = {}) => {
	const typesWithSets = [
		types,
		[
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
		],
	];

	const typeDefs = generateTypeDefs({
		enableDocumentHits,
		rootTypes,
		scalarTypes,
		types: typesWithSets,
	});

	const resolvers = generateResolvers({
		enableAdmin,
		enableDocumentHits,
		getServerSideFilter,
		rootTypes,
		scalarTypes,
		setsIndex,
		types: typesWithSets,
	});

	const schema = makeExecutableSchema({
		typeDefs,
		resolvers,
		resolverValidationOptions: {
			// this disables a warning which we are ok with (https://github.com/prisma/prisma/issues/2225)
			requireResolversForResolveType: false,
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

export default makeSchema;
