// TODO: for TS, we'll have to update "apollo-server-express" (which relies on graphql updates too)
import { mergeSchemas } from '@graphql-tools/schema';
import type { IResolvers } from '@graphql-tools/utils';
import {
	configArrangerNetworkProperties,
	type ConfigsObject,
	type GetServerSideFilterFn,
	type LocalNodeConfig,
} from '@overture-stack/arranger-types/configs';
import { configOptionalProperties, configRootProperties } from '@overture-stack/arranger-types/configs/constants';
import { ApolloServerPluginLandingPageDisabled } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { GraphQLSchema } from 'graphql';

import { initializeSets } from '#config/index.js';
import { extendCharts } from '#mapping/extendCharts.js';
import { extendColumns, extendFacets, flattenMappingToFields } from '#mapping/extendMapping.js';
import { addMappingsToTypes, extendFields } from '#mapping/index.js';
import mappingToAggregationFields from '#mapping/mappingToAggregationFields.js';
import { createSchemaFromNetworkConfig } from '#network/index.js';
import type { LocalCatalogSchemaData } from '#network/types.js';
import { createCatalogResolvers, createSchemaForResolvers } from '#schema/index.js';
import type { SchemaTypesTuple } from '#schema/types.js';
import type { SearchClient } from '#searchClient/index.js';
import type { ArrangerBaseContext, GraphQLEndpointOptions, RequestContextProps } from '#types.js';
import { addContext } from '#utils/context.js';
import { maxAliasesRule, maxDepthRule } from '#utils/queryValidation.js';

// TODO: Fix types once SearchClient response types are merged
const getTypesWithMappings = async <Context extends ArrangerBaseContext>({
	enableDebug,
	mappingFromIndex,
	configs,
}: {
	enableDebug: boolean;
	mappingFromIndex: any;
	configs: ConfigsObject<Context>;
}) => {
	if (Object.keys(configs).length > 0) {
		try {
			console.log('  - Now creating a GraphQL mapping based on the ES index:');

			const fieldsFromMapping = flattenMappingToFields(mappingFromIndex);

			// Combines the mapping from ES with the "extended" custom configs
			const extendedFields = await (async () => {
				try {
					const extendedConfigs = configs?.[configRootProperties.EXTENDED];
					if (!extendedConfigs) {
						throw new Error('No extended configs were provided.');
					}
					return extendFields(fieldsFromMapping, extendedConfigs);
				} catch (err) {
					console.log(
						'    Something happened while extending the ES mappings.\n' +
							'    Defaulting to "extended" config from files.\n',
					);
					enableDebug && console.debug(`  DEBUG: ${err}`);

					return configs?.[configRootProperties.EXTENDED] || [];
				}
			})();

			// Uses the "extended" fields to enhance the "facets" custom configs
			const extendedFacetsConfigs = await (async () => {
				try {
					const facetsConfigs = configs?.[configRootProperties.FACETS];
					if (!facetsConfigs) {
						throw new Error('No facets config provided.');
					}
					return extendFacets(facetsConfigs, extendedFields);
				} catch (err) {
					console.log(
						'    Something happened while extending the column mappings.\n' +
							'    Defaulting to "table" config from files.\n',
					);
					enableDebug && console.debug(`  DEBUG: ${err}`);

					return configs?.[configRootProperties.TABLE] || [];
				}
			})();

			// Uses the "extended" fields to enhance the "table" custom configs
			const extendedTableConfigs = await (async () => {
				try {
					const tableConfigs = configs?.[configRootProperties.TABLE];
					if (!tableConfigs) {
						throw new Error('No table configs provided.');
					}
					return extendColumns(tableConfigs, extendedFields);
				} catch (err) {
					console.log(
						'    Something happened while extending the column mappings.\n' +
							'    Defaulting to "table" config from files.\n',
					);
					enableDebug && console.debug(`  DEBUG: ${err}`);

					return configs?.[configRootProperties.TABLE] || [];
				}
			})();

			// Validate and enchance charts config with dynamic properties
			const extendedChartsConfigs = extendCharts(configs?.[configRootProperties.CHARTS], extendedFields);

			const typesWithMappings = addMappingsToTypes({
				graphQLType: {
					config: {
						...configs,
						[configRootProperties.CHARTS]: extendedChartsConfigs,
						[configRootProperties.FACETS]: extendedFacetsConfigs,
						[configRootProperties.TABLE]: extendedTableConfigs,
					},
					customFields: '',
					extendedFields,
					index: configs?.[configRootProperties.ES_INDEX],
					name: configs?.[configRootProperties.DOCUMENT_TYPE],
				},
				mapping: mappingFromIndex,
			});

			return {
				fieldsFromMapping,
				typesWithMappings,
			};
		} catch (error) {
			console.error(error instanceof Error ? error.message : error);
			throw '  Something went wrong while creating the GraphQL mapping';
		}
	}

	throw new Error('  No configs available at getTypesWithMappings');
};

/**
 * Create GQL schema and mockSchema based on type configuration and runtime flags.
 */
const createSchema = <Context extends ArrangerBaseContext>({
	enableDebug = false,
	enableAdmin = false,
	getServerSideFilter,
	graphqlOptions = {},
	setsIndex,
	types,
}: {
	enableDebug?: boolean;
	enableAdmin?: boolean;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	setsIndex: string;
	types: SchemaTypesTuple;
}): { schema: GraphQLSchema; mockSchema: GraphQLSchema; resolvers: IResolvers<any, Context> } => {
	const { resolvers, typesWithSets } = createCatalogResolvers({
		debug: enableDebug,
		enableAdmin,
		getServerSideFilter,
		setsIndex,
		types,
	});

	return {
		mockSchema: createSchemaForResolvers({
			mock: true,
			typesWithSets,
			resolvers,
		}),
		schema: createSchemaForResolvers({
			mock: false,
			middleware: graphqlOptions.middleware || [],
			typesWithSets,
			resolvers,
		}),
		resolvers,
	};
};

const noSchemaHandler =
	(endpoint = 'unspecified'): RequestHandler =>
	(_req, res) => {
		console.log(`  - Something went wrong initialising a GraphQL endpoint: ${endpoint}`);

		return res.json({
			error: 'Schema is undefined. Make sure your server has a valid GraphQL Schema.',
		});
	};

export const createEndpoint = async <Context extends ArrangerBaseContext>({
	disablePlayground,
	enableDebug = false,
	esClient,
	graphqlOptions = {},
	maxAliases,
	maxDepth,
	mockSchema,
	schema,
}: {
	disablePlayground: boolean;
	enableDebug?: boolean;
	esClient: SearchClient;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	maxAliases?: number;
	maxDepth?: number;
	mockSchema: GraphQLSchema;
	schema: GraphQLSchema;
}) => {
	const mainPath = '/graphql';
	const mockPath = '/mock/graphql';
	const router = Router();

	console.log('\n------\nStarting GraphQL server:');

	const apolloFeatureFlags = disablePlayground && { plugins: [ApolloServerPluginLandingPageDisabled()] };
	const validationRules = [maxAliasesRule(maxAliases), maxDepthRule(maxDepth)];

	try {
		// TODO: D.R.Y this thing!

		if (schema) {
			// TODO: It is unclear what the value for connection should be, or where it is sourced from. This type can be tightened (or removed?).
			const buildContext = async (req: Request, res: Response, connection: any) => {
				// Add request information to context as needed for ArrangeBaseContext.request
				const headers = new Headers();
				for (const [key, value] of Object.entries(req.headers)) {
					if (value !== undefined) {
						const valueAsString = Array.isArray(value) ? value.join(', ') : value;
						headers.set(key, valueAsString);
					}
				}
				const request: RequestContextProps = { headers };

				// Add to context based on external parameters
				const externalContext =
					typeof graphqlOptions.context === 'function'
						? await graphqlOptions.context(req, res, connection)
						: graphqlOptions.context;

				return {
					esClient,
					request,
					...(externalContext || {}),
				};
			};

			// TODO: context type mismatch
			const apolloServer = new ApolloServer({
				cache: 'bounded',
				context: ({ req, res, con }) => buildContext(req, res, con),
				introspection: !!(process.env.NODE_ENV !== 'production'),
				schema,
				validationRules,
				...apolloFeatureFlags,
			});

			await apolloServer.start();

			// TODO: invalid types between router and the app expected by apolloServer. Works as is but types are not valid.
			apolloServer.applyMiddleware({
				app: router,
				path: mainPath,
			});

			console.log(`  - GraphQL endpoint running at ...${mainPath}`);
			console.log(`  - GraphQL playground available at ...${mainPath}`);
		} else {
			router.use(mainPath, noSchemaHandler(mainPath));
		}

		if (mockSchema) {
			const apolloMockServer = new ApolloServer({
				cache: 'bounded',
				schema: mockSchema,
				validationRules,
				...apolloFeatureFlags,
			});

			await apolloMockServer.start();

			apolloMockServer.applyMiddleware({
				app: router,
				path: '/mock/graphql',
			});

			console.log(`  - GraphQL mock endpoint running at ...${mockPath}`);
		} else {
			router.use(mockPath, noSchemaHandler(mockPath));
		}
	} catch (err) {
		enableDebug && console.debug(`  DEBUG: ${err}`);
		// FIXME: Throw better!
		throw err;
	}

	router.use(
		'/',
		addContext({
			schema,
			mockSchema,
		}),
	);

	console.log('\n  Success!');

	return router;
};

export const createSchemasFromConfigs = async <Context extends ArrangerBaseContext>({
	configs,
	enableDebug = false,
	enableAdmin = false,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
	mappingFromIndex,
	setsIndex,
}: {
	configs: ConfigsObject<Context>;
	enableDebug?: boolean;
	enableAdmin?: boolean;
	esClient: SearchClient;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	mappingFromIndex: Record<string, unknown>;
	setsIndex: string;
}) => {
	try {
		if (!configs) {
			throw new Error('  No configs were provided. Please provide a config object.');
		}

		const { fieldsFromMapping, typesWithMappings } = await getTypesWithMappings<Context>({
			configs,
			enableDebug,
			mappingFromIndex,
		});

		const { mockSchema, schema, resolvers } = await createSchema({
			enableDebug,
			enableAdmin,
			getServerSideFilter,
			graphqlOptions,
			setsIndex,
			types: typesWithMappings,
		});

		const schemasToMerge = [schema];

		/**
		 * Federated Network Search
		 */
		const networkConfigsObj = configs[configRootProperties.NETWORK_AGGREGATION];

		if (networkConfigsObj) {
			enableDebug &&
				console.debug(
					'    DEBUG: `network` config provided for network aggregation. Adding network search to the gql schema...',
				);

			// TODO: This initial setup assumes that the config only references the local catalog,
			//       needs to be updated for a multi-catalog setup with the localCatalog info provided in the function argumemnts
			const localCatalogId = 'local';
			const configLocalNodeProps = networkConfigsObj[configArrangerNetworkProperties.LOCAL_NODE];
			const localNodeConfigs: LocalNodeConfig[] = configLocalNodeProps
				? [{ catalogId: localCatalogId, ...configLocalNodeProps }]
				: [];

			// Build local catalogs by extracting aggregations and hits resolvers from the provided resolvers
			// TODO: Move this extraction to the calling function (search-server), its their responsibility to provide only the required resolvers for each catalog
			const localCatalogs: LocalCatalogSchemaData<Context>[] = [];

			const documentResolvers = resolvers[configs.documentType];
			if (documentResolvers && typeof documentResolvers === 'object') {
				const aggregationResolver =
					'aggregations' in documentResolvers &&
					typeof documentResolvers['aggregations'] === 'function' &&
					documentResolvers['aggregations'];
				const hitsResolver =
					'hits' in documentResolvers &&
					typeof documentResolvers['hits'] === 'function' &&
					documentResolvers['hits'];
				const aggregations = mappingToAggregationFields(mappingFromIndex);

				// If the resolvers were where we expected them to be, pass them into the
				if (aggregationResolver && hitsResolver) {
					localCatalogs.push({
						catalogId: localCatalogId,
						configs: { aggregations },
						resolvers: { aggregations: aggregationResolver, hits: hitsResolver },
					});
				}
			}

			const networkSchemaResult = await createSchemaFromNetworkConfig<Context>({
				customizeRemoteRequest: configs?.network?.customizeRemoteRequest,
				enableDebug,
				remoteNodeConfigs: networkConfigsObj[configArrangerNetworkProperties.REMOTE_NODES] ?? [],
				localNodeConfigs,
				localCatalogs,
			});
			if (networkSchemaResult.success) {
				schemasToMerge.push(networkSchemaResult.data);
			} else {
				console.error(
					`Error creating network schema for catalog ${configs.catalogId} - ${networkSchemaResult.case}. No network search can be added to the GQL schema.`,
				);
			}
		}

		const fullSchema = mergeSchemas({ schemas: schemasToMerge });

		console.log('\n  Success!');

		return {
			fieldsFromMapping,
			typesWithMappings,
			mockSchema,
			schema: fullSchema,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : error;

		console.info('\n------\nError thrown while creating the GraphQL schemas.');
		console.error(message);

		throw '  Something went wrong while creating the GraphQL schemas';
	}
};

export type ArrangerRoutesArgs<Context extends ArrangerBaseContext> = {
	configs: ConfigsObject<Context>;
	enableDebug?: boolean;
	enableAdmin?: boolean;
	esClient: SearchClient;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	mappingFromIndex: Record<string, unknown>;
};
const arrangerRoutes = async <Context extends ArrangerBaseContext = ArrangerBaseContext>({
	configs,
	enableDebug,
	enableAdmin,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
	mappingFromIndex,
}: ArrangerRoutesArgs<Context>): Promise<RequestHandler | RequestHandler[]> => {
	// TODO: surfacing this variable to be reused later
	const setsIndex = configs[configOptionalProperties.SETS]?.index || 'arranger-sets';

	try {
		const { fieldsFromMapping, mockSchema, schema, typesWithMappings } = await createSchemasFromConfigs({
			configs,
			enableDebug,
			enableAdmin,
			esClient,
			getServerSideFilter,
			graphqlOptions,
			mappingFromIndex,
			setsIndex,
		});

		const graphQLEndpoints = await createEndpoint({
			disablePlayground: configs[configOptionalProperties.DISABLE_GRAPHQL_PLAYGROUND] ?? false,
			enableDebug,
			esClient,
			graphqlOptions,
			maxAliases: configs[configOptionalProperties.GRAPHQL_MAX_ALIASES],
			maxDepth: configs[configOptionalProperties.GRAPHQL_MAX_DEPTH],
			mockSchema,
			schema,
		});

		await initializeSets({
			enableDebug,
			esClient,
			setsIndex,
		});

		return [
			// this middleware makes the esClient and config available in all requests, in a "context" object
			addContext({
				configs: typesWithMappings?.[1],
				esClient,
				fieldsFromMapping,
			}),
			graphQLEndpoints,
		];
	} catch (error) {
		const message = error instanceof Error ? error.message : `${error}`;
		// if endpoint creation fails, let the next server step to respond with an error
		console.info('\n------\nError thrown while generating the GraphQL endpoints.');
		console.error(message);

		return (req, res) =>
			res.status(500).send({
				// TODO: revisit this response
				detail: 'Please notify the systems admin - ',
				message: message.trim() || 'The GraphQL server is unavailable due to an internal error',
				type: 'system/unspecified-internal-error',
			});
	}
};

export default arrangerRoutes;
