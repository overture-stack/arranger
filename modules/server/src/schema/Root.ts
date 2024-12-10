import type { Client } from '@elastic/elasticsearch/api/new';
import { GraphQLDate } from 'graphql-scalars';
import { GraphQLJSON } from 'graphql-type-json';
import { startCase } from 'lodash-es';
import Parallel from 'paralleljs';

import { ENV_CONFIG } from '#config/index.js';
import { createConnectionResolvers, saveSet, mappingToFields } from '#mapping/index.js';
import { checkESAlias, getESAliases } from '#mapping/utils/fetchMapping.js';

import { typeDefs as AggregationsTypeDefs } from './Aggregations.js';
import ConfigsTypeDefs from './configQuery.js';
import { typeDefs as SetTypeDefs } from './Sets.js';
import { typeDefs as SortTypeDefs } from './Sort.js';

const RootTypeDefs = ({ types, rootTypes, scalarTypes }) => `
	scalar JSON
	scalar Date
	enum EsRefresh {
		TRUE
		FALSE
		WAIT_FOR
	}

	${scalarTypes.map(([type]) => `scalar ${type}`)}

	interface Node {
		id: ID!
	}

	type FileSize {
		value: Float
	}

	type QueryResults {
		total: Int
		hits: [Node]
	}

	type Root {
		node(id: ID!): Node
		viewer: Root
		query(query: String, types: [String]): QueryResults

		hasValidConfig(documentType: String!, index: String!): Boolean

		${rootTypes.map(([key]) => `${key}: ${startCase(key).replace(/\s/g, '')}`)}

		${types.map(([key, type]) => `${type.name}: ${type.name}`)}
	}

	${rootTypes.map(([, type]) => type.typeDefs)}

	enum DocumentType {
		${types.map(([key, type]) => type.name).join('\n')}
	}

	type Mutation {
		saveSet(type: DocumentType! userId: String sqon: JSON! path: String! sort: [Sort] refresh: EsRefresh): Set
	}

	schema {
		query: Root
		mutation: Mutation
	}
`;

export const typeDefs = ({ enableDocumentHits, types, rootTypes, scalarTypes }) => [
	RootTypeDefs({ types, rootTypes, scalarTypes }),
	AggregationsTypeDefs({ enableDocumentHits }),
	SetTypeDefs,
	SortTypeDefs,
	ConfigsTypeDefs,
	...types.map(([key, type]) => mappingToFields({ enableDocumentHits, type, parent: '' })),
];

const resolveObject = () => ({});

export let resolvers = ({
	enableAdmin,
	enableDocumentHits,
	dataMaskThreshold,
	types,
	rootTypes,
	scalarTypes,
	getServerSideFilter,
}) => {
	return {
		JSON: GraphQLJSON,
		Date: GraphQLDate,
		Root: {
			viewer: resolveObject,
			hasValidConfig: async (obj, { documentType, index }, { esClient }: { esClient: Client }) => {
				if (documentType) {
					if (index) {
						const [_, type] = types.find(([name]) => name === documentType) || [];

						// TODO: make this more useful/verbose;
						if (type) {
							try {
								const aliases = await getESAliases(esClient);
								const foundAlias = checkESAlias(aliases, index);

								const isValidIndex = [foundAlias, index].includes(type.index);

								return isValidIndex && Object.keys(type.config).length > 0;
							} catch (err) {
								const message = 'Something went wrong reaching ES';

								ENV_CONFIG.DEBUG_MODE && console.error(message, err.message || err);
								return new Error(message);
							}
						}
						return new Error(`No index was found by the name/alias "${index}"`);
					}

					return new Error(`This endpoint requires an ES index or alias`);
				}

				return new Error(`This endpoint requires a "Document Type"`);
			},
			...[...types, ...rootTypes].reduce((acc, [key, type]) => {
				const accessor = type.name || key;

				return accessor.length > 0
					? {
							...acc,
							[accessor]: resolveObject,
						}
					: acc;
			}, {}),
		},
		...types.reduce(
			(acc, [key, type]) => ({
				...acc,
				...createConnectionResolvers({
					createStateResolvers: 'createState' in type ? type.createState : true,
					enableAdmin,
					enableDocumentHits,
					dataMaskThreshold,
					getServerSideFilter,
					Parallel,
					type,
				}),
			}),
			{},
		),
		...rootTypes.reduce(
			(acc, [key, type]) => ({
				...acc,
				...(type.resolvers ? { [startCase(key).replace(/\s/g, '')]: type.resolvers } : {}),
			}),
			{},
		),
		...scalarTypes.reduce(
			(acc, [scalar, resolver]) => ({
				...acc,
				[scalar]: resolver,
			}),
			{},
		),
		Mutation: {
			saveSet: saveSet({ getServerSideFilter, setsIndex, types }),
		},
	};
};
