import type { IResolvers } from '@graphql-tools/utils';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { GraphQLDate } from 'graphql-scalars';
import { GraphQLJSON } from 'graphql-type-json';
import { startCase } from 'lodash-es';
import Parallel from 'paralleljs';

import { createConnectionResolvers, mappingToFields, saveSet } from '#mapping/index.js';
import { checkESAlias, getESAliases } from '#searchClient/fetchMapping.js';
import type { ArrangerBaseContext } from '#types.js';

import { typeDefs as AggregationsTypeDefs } from './Aggregations.js';
import ConfigsTypeDefs from './configQuery.js';
import { typeDefs as SetTypeDefs } from './Sets.js';
import { typeDefs as SortTypeDefs } from './Sort.js';
import type { SchemaTypesTuple } from './types.js';

// TODO: Narrow the rootTypes and scalarTypes type definitions
type TypeDefsArgs = {
	types: SchemaTypesTuple[];
	rootTypes: any[];
	scalarTypes: any[];
};

const RootTypeDefs = ({ types, rootTypes, scalarTypes }: TypeDefsArgs) => `
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

export const typeDefs = ({ types, rootTypes, scalarTypes }: TypeDefsArgs) => [
	RootTypeDefs({ types, rootTypes, scalarTypes }),
	AggregationsTypeDefs,
	SetTypeDefs,
	SortTypeDefs,
	ConfigsTypeDefs,
	...types.map(([key, type]) => mappingToFields({ type, parent: '' })),
];

const resolveEmptyObject = () => ({});

type CreateResolversArgs<Context extends ArrangerBaseContext> = {
	debug: boolean;
	enableAdmin?: boolean;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	rootTypes: any[];
	scalarTypes: any[];
	setsIndex: string;
	types: SchemaTypesTuple[];
};

export const resolvers = <Context extends ArrangerBaseContext>({
	debug,
	enableAdmin = false,
	getServerSideFilter,
	rootTypes,
	scalarTypes,
	setsIndex,
	types,
}: CreateResolversArgs<Context>): IResolvers<any, Context> => {
	return {
		JSON: GraphQLJSON,
		Date: GraphQLDate,
		Root: {
			viewer: resolveEmptyObject,
			hasValidConfig: async (
				root: unknown,
				{ documentType, index, esIndex }: { documentType: string; index: string; esIndex: string },
				{ esClient }: Context,
			) => {
				if (documentType) {
					const documentIndex = esIndex ?? index;

					if (documentIndex) {
						const [_, type] = types.find(([name]) => name === documentType) || [];

						// TODO: make this more useful/verbose;
						if (type) {
							try {
								const aliases = await getESAliases(esClient);
								const foundAlias = checkESAlias(aliases, documentIndex);

								const isValidIndex = [foundAlias, documentIndex].includes(type.index);

								return isValidIndex && Object.keys(type.config).length > 0;
							} catch (err) {
								const message = 'Something went wrong reaching ES';

								debug && console.error(message, err instanceof Error ? err.message : err);
								return new Error(message);
							}
						}
						return new Error(`No index was found by the name/alias "${documentIndex}"`);
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
							[accessor]: resolveEmptyObject,
						}
					: acc;
			}, {}),
		},

		// Create resolvers for each provided document type (typically: one configured type and `sets`)
		...types.reduce(
			(acc, [key, type]) => ({
				...acc,
				...createConnectionResolvers<Context>({
					createStateResolvers: 'createState' in type ? type.createState : true,
					enableAdmin,
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
