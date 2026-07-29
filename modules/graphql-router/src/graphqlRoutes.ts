// TODO: for TS, we'll have to update "apollo-server-express" (which relies on graphql updates too)
import { mergeSchemas } from '@graphql-tools/schema';
import type { IResolvers } from '@graphql-tools/utils';
import {
	configArrangerNetworkProperties,
	type ConfigsObject,
	type GetServerSideFilterFn,
	type LocalNodeConfig,
} from '@overture-stack/arranger-types/configs';
import {
	configFeatureFlagProperties,
	configOptionalProperties,
	configRootProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { ApolloServerPluginLandingPageDisabled } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import { Router, type Request, type RequestHandler, type Response } from 'express';
import type { GraphQLError, GraphQLFormattedError, GraphQLSchema } from 'graphql';

import { initializeSets } from '#config/index.js';
import { extendCharts } from '#mapping/extendCharts.js';
import { extendColumns, extendFacets, flattenMappingToFields } from '#mapping/extendMapping.js';
import { addMappingsToTypes, extendFields } from '#mapping/index.js';
import mappingToAggregationFields from '#mapping/mappingToAggregationFields.js';
import { createSchemaFromNetworkConfig } from '#network/index.js';
import type { LocalCatalogueSchemaData } from '#network/types.js';
import { createCatalogueResolvers, createSchemaForResolvers } from '#schema/index.js';
import type { SchemaTypesTuple } from '#schema/types.js';
import { SCHEMA_BUILD_ERROR_NAME, type SearchClient } from '#searchClient/index.js';
import type { ArrangerBaseContext, GraphQLEndpointOptions, RequestContextProps } from '#types.js';
import { addContext } from '#utils/context.js';
import { maxAliasesRule, maxDepthRule } from '#utils/queryValidation.js';

/** Placeholder `label` used when no catalogue identifier was provided or configured, e.g. a third-party server embedding a single catalogue with no multicatalogue context to label. */
export const FALLBACK_LABEL = 'unlabelled catalogue';

/** True when `label` is the placeholder rather than a real catalogue identifier, so callers can omit the label clause from a log line entirely instead of printing it. */
export const isFallbackLabel = (label = '') => label === FALLBACK_LABEL;

/** Wraps a schema/endpoint-build failure with the marker `classifyCatalogueFailureReason` recognizes, preserving the original error as `cause`. */
const schemaBuildError = (message: string, cause: unknown): Error =>
	Object.assign(new Error(message, { cause }), { name: SCHEMA_BUILD_ERROR_NAME });

// TODO: Fix types once SearchClient response types are merged
const getTypesWithMappings = async <Context extends ArrangerBaseContext>({
	configs,
	enableDebug,
	label,
	mappingFromIndex,
}: {
	enableDebug: boolean;
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. */
	label?: string;
	mappingFromIndex: any;
	configs: ConfigsObject<Context>;
}) => {
	if (Object.keys(configs).length > 0) {
		try {
			console.log(
				`  - Now creating a GraphQL mapping based on the index${isFallbackLabel(label) ? '' : ` for "${label}"`}:`,
			);

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
						'    Something happened while extending the facet mappings.\n' +
							'    Defaulting to "facets" config from files.\n',
					);
					enableDebug && console.debug(`  DEBUG: ${err}`);

					return configs?.[configRootProperties.FACETS] || [];
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
			enableDebug &&
				console.error(
					`  DEBUG${isFallbackLabel(label) ? '' : ` (${label})`}: ${error instanceof Error ? error.message : error}`,
				);
			throw schemaBuildError('Something went wrong while creating the GraphQL mapping', error);
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
	const { resolvers, typesWithSets } = createCatalogueResolvers({
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

// graphql-js appends "Did you mean ...?" field-name suggestions to validation errors on a
// separate code path from introspection, so they leak schema structure even when
// disableGraphQLIntrospection is true.
//
// Not every error Apollo that runs through this hook is a GraphQLError with a working `toJSON`
// (e.g. the batching-disabled rejection is a plain Error), so we build the formatted shape from
// the enumerable fields Apollo has already normalized onto `error` rather than calling
// graphql-js's `formatError`/`error.toJSON()`, which assumes a GraphQLError prototype.
// TODO: evaluate whether this is needed after switching away from Apollo
const FIELD_SUGGESTION_SUFFIX = / Did you mean .+\?$/i;
const formatError = (error: GraphQLError): GraphQLFormattedError => ({
	...error,
	message: error.message.replace(FIELD_SUGGESTION_SUFFIX, ''),
});

export const createEndpoint = async <Context extends ArrangerBaseContext>({
	disableGraphQLIntrospection,
	disablePlayground,
	enableDebug,
	enableGraphQLBatching = false,
	esClient,
	graphqlOptions = {},
	label,
	maxAliases,
	maxDepth,
	mockSchema,
	schema,
}: {
	disableGraphQLIntrospection?: boolean;
	disablePlayground: boolean;
	enableDebug?: boolean;
	enableGraphQLBatching?: boolean;
	esClient: SearchClient;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. */
	label?: string;
	maxAliases?: number;
	maxDepth?: number;
	mockSchema: GraphQLSchema;
	schema: GraphQLSchema;
}) => {
	const mainPath = '/graphql';
	const mockPath = '/mock/graphql';
	const router = Router();

	console.log(`\n------\nStarting GraphQL server${isFallbackLabel(label) ? '' : ` for "${label}"`}:`);

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
				allowBatchedHttpRequests: enableGraphQLBatching,
				cache: 'bounded',
				context: ({ req, res, con }) => buildContext(req, res, con),
				formatError,
				introspection: !disableGraphQLIntrospection,
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
				allowBatchedHttpRequests: enableGraphQLBatching,
				cache: 'bounded',
				formatError,
				introspection: !disableGraphQLIntrospection,
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
		enableDebug && console.debug(`  DEBUG${isFallbackLabel(label) ? '' : ` (${label})`}: ${err}`);
		throw schemaBuildError('Something went wrong while starting the GraphQL endpoint', err);
	}

	router.use(
		'/',
		addContext({
			schema,
			mockSchema,
		}),
	);

	console.log(`\n  Success!${isFallbackLabel(label) ? '' : ` ("${label}")`}`);

	return router;
};

export const createSchemasFromConfigs = async <Context extends ArrangerBaseContext>({
	configs,
	enableDebug = false,
	enableAdmin = false,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
	label,
	mappingFromIndex,
	setsIndex,
}: {
	configs: ConfigsObject<Context>;
	enableDebug?: boolean;
	enableAdmin?: boolean;
	esClient: SearchClient;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. */
	label?: string;
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
			label,
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

			// TODO: This initial setup assumes that the config only references the local catalogue,
			//       needs to be updated for a multi-catalogue setup with the local catalogue info provided in the function arguments
			const localCatalogId = 'local';
			const configLocalNodeProps = networkConfigsObj[configArrangerNetworkProperties.LOCAL_NODE];
			const localNodeConfigs: LocalNodeConfig[] = configLocalNodeProps
				? [{ catalogId: localCatalogId, ...configLocalNodeProps }]
				: [];

			// Build local catalogues by extracting aggregations and hits resolvers from the provided resolvers
			// TODO: Move this extraction to the calling function (search-server), it's their responsibility to provide only the required resolvers for each catalogue
			const localCatalogues: LocalCatalogueSchemaData<Context>[] = [];

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
					localCatalogues.push({
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
				localCatalogues,
			});
			if (networkSchemaResult.success) {
				schemasToMerge.push(networkSchemaResult.data);
			} else {
				console.error(
					`Error creating network schema for catalogue ${configs.catalogId} - ${networkSchemaResult.case}. No network search can be added to the GQL schema.`,
				);
			}
		}

		const fullSchema = mergeSchemas({ schemas: schemasToMerge });

		console.log(`\n  Success!${isFallbackLabel(label) ? '' : ` ("${label}")`}`);

		return {
			fieldsFromMapping,
			typesWithMappings,
			mockSchema,
			schema: fullSchema,
		};
	} catch (error: unknown) {
		console.info(
			`\n------\nError thrown while creating the GraphQL schemas${isFallbackLabel(label) ? '' : ` for "${label}"`}.`,
		);
		enableDebug && console.error(error instanceof Error ? error.message : error);

		throw schemaBuildError('Something went wrong while creating the GraphQL schemas', error);
	}
};

export type ArrangerRoutesArgs<Context extends ArrangerBaseContext> = {
	configs: ConfigsObject<Context>;
	enableAdmin?: boolean;
	enableDebug?: boolean;
	esClient: SearchClient;
	getServerSideFilter: GetServerSideFilterFn<Context>;
	graphqlOptions?: GraphQLEndpointOptions<Context>;
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. */
	label?: string;
	mappingFromIndex: Record<string, unknown>;
	/** When true, a schema/endpoint build failure is rethrown instead of caught and turned into a 500-responding handler. Off by default so direct callers of this function keep today's contract (never rejects); `arrangerRouter` opts in, since it already classifies and reports a rejected catalogue as `failed` rather than crashing. */
	rethrowOnError?: boolean;
};

const arrangerRoutes = async <Context extends ArrangerBaseContext = ArrangerBaseContext>({
	configs,
	enableAdmin,
	enableDebug,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
	label = configs[configRootProperties.DOCUMENT_TYPE] || FALLBACK_LABEL,
	mappingFromIndex,
	rethrowOnError = false,
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
			label,
			mappingFromIndex,
			setsIndex,
		});

		const graphQLEndpoints = await createEndpoint({
			disableGraphQLIntrospection: configs[configOptionalProperties.DISABLE_GRAPHQL_INTROSPECTION] ?? false,
			disablePlayground: configs[configOptionalProperties.DISABLE_GRAPHQL_PLAYGROUND] ?? false,
			enableDebug,
			enableGraphQLBatching: configs[configOptionalProperties.ENABLE_GRAPHQL_BATCHING] ?? false,
			esClient,
			graphqlOptions,
			label,
			maxAliases: configs[configOptionalProperties.GRAPHQL_MAX_ALIASES],
			maxDepth: configs[configOptionalProperties.GRAPHQL_MAX_DEPTH],
			mockSchema,
			schema,
		});

		try {
			await initializeSets({
				enableSets: configs[configFeatureFlagProperties.ENABLE_SETS] ?? false,
				enableDebug,
				esClient,
				setsIndex,
			});
		} catch (setsError) {
			const message = setsError instanceof Error ? setsError.message : `${setsError}`;
			console.error(
				`\n------\nSets initialization failed: ${message}\nThe catalogue endpoint will continue without Sets support.`,
			);
		}

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
		console.info(
			`\n------\nError thrown while generating the GraphQL endpoints${isFallbackLabel(label) ? '' : ` for "${label}"`}.`,
		);
		console.error(message);

		if (rethrowOnError) {
			throw error;
		}

		// if endpoint creation fails and the caller didn't opt into rethrowOnError, let the next server step respond with an error
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
