import type { IResolvers } from '@graphql-tools/utils';
import type { GetServerSideFilterFn } from '@overture-stack/arranger-types/configs';
import { GraphQLDate } from 'graphql-scalars';
import { GraphQLJSON } from 'graphql-type-json';
import { startCase } from 'lodash-es';
import Parallel from 'paralleljs';

import { createConnectionResolvers, mappingToFields, saveSet } from '#mapping/index.js';
import { checkESAlias, getESAliases } from '#searchClient/fetchMapping.js';
import { createScopedSetsResolvers } from '#sets/scopedSetsResolvers.js';
import { type GetRequesterFn, narrowsSetRecords } from '#sets/setsAccess.js';
import { SetsDisabledError } from '#sets/SetsDisabledError.js';
import type { ArrangerBaseContext } from '#types.js';

import { typeDefs as AggregationsTypeDefs } from './Aggregations.js';
import ConfigsTypeDefs from './configQuery.js';
import { typeDefs as SetTypeDefs } from './Sets.js';
import { typeDefs as SortTypeDefs } from './Sort.js';
import type { SchemaTypesDefinition, SchemaTypesTuple } from './types.js';

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
	enableSets?: boolean;
	getRequester?: GetRequesterFn<Context>;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	rootTypes: any[];
	scalarTypes: any[];
	setsIndex: string;
	types: SchemaTypesTuple[];
};

/**
 * The connection resolvers for one document type. The `sets` type is scoped to its requester. While saved sets are not
 * enabled, its hits and aggregations are refused before any search or requester check, so no read of saved sets
 * reaches the engine.
 */
const createTypeConnectionResolvers = <Context extends ArrangerBaseContext>({
	catalogueTypes,
	enableAdmin,
	enableSets,
	getRequester,
	getServerSideFilter,
	narrowed,
	type,
}: {
	catalogueTypes: SchemaTypesDefinition[];
	enableAdmin: boolean;
	enableSets: boolean;
	getRequester: GetRequesterFn<Context> | undefined;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	narrowed: boolean;
	type: SchemaTypesDefinition;
}): IResolvers<any, Context> => {
	if (type.name !== 'sets') {
		return createConnectionResolvers<Context>({
			createStateResolvers: 'createState' in type ? type.createState : true,
			enableAdmin,
			getRequester,
			getServerSideFilter,
			Parallel,
			type,
		});
	}

	const scopedResolvers = createScopedSetsResolvers<Context>({
		catalogueTypes,
		enableAdmin,
		getRequester,
		getServerSideFilter,
		narrowed,
		Parallel,
		setsType: type,
	});

	if (enableSets) {
		return scopedResolvers;
	}

	const refuseSavedSetsRead = (): never => {
		throw new SetsDisabledError();
	};
	const setsResolvers = scopedResolvers[type.name] as object | undefined;

	return {
		...scopedResolvers,
		[type.name]: {
			...setsResolvers,
			aggregations: refuseSavedSetsRead,
			hits: refuseSavedSetsRead,
		},
	};
};

export const resolvers = <Context extends ArrangerBaseContext>({
	debug,
	enableAdmin = false,
	enableSets = false,
	getRequester,
	getServerSideFilter,
	rootTypes,
	scalarTypes,
	setsIndex,
	types,
}: CreateResolversArgs<Context>): IResolvers<any, Context> => {
	// A filter callback narrows each set's records to its reader, and getRequester gives each set an owner.
	const setRecordsNarrowed = narrowsSetRecords(getServerSideFilter);
	const catalogueTypes = types.filter(([key]) => key !== 'sets').map(([, type]) => type);

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
			(acc, [, type]) => ({
				...acc,
				...createTypeConnectionResolvers<Context>({
					catalogueTypes,
					enableAdmin,
					enableSets,
					getRequester,
					getServerSideFilter,
					narrowed: setRecordsNarrowed,
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
			saveSet: saveSet({ enableSets, getRequester, getServerSideFilter, setsIndex, types }),
		},
	};
};
