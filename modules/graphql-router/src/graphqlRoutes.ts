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

import {
	ACCESS_CONTROL_FAILURE_MESSAGE,
	ACCESS_CONTROL_QUERY_TOO_LARGE_CODE,
	type AccessControlError,
	type AccessControlQueryTooLargeError,
	isAccessControlError,
	isAccessControlQueryTooLargeError,
} from '#accessControl/AccessControlError.js';
import { assertFilterCallback } from '#accessControl/filterCallback.js';
import fallbackConfigs, { initializeSets } from '#config/index.js';
import { extendCharts } from '#mapping/extendCharts.js';
import { extendColumns, extendFacets, flattenMappingToFields } from '#mapping/extendMapping.js';
import { addMappingsToTypes, resolveExtendedFields } from '#mapping/index.js';
import mappingToAggregationFields from '#mapping/mappingToAggregationFields.js';
import { buildGraphqlNameRegistry } from '#mapping/utils/graphqlNameRegistry.js';
import { isInvalidFilterError } from '#middleware/buildQuery/InvalidFilterError.js';
import { createSchemaFromNetworkConfig } from '#network/index.js';
import type { LocalCatalogueSchemaData } from '#network/types.js';
import { createCatalogueResolvers, createSchemaForResolvers } from '#schema/index.js';
import type { SchemaTypesTuple } from '#schema/types.js';
import { SCHEMA_BUILD_ERROR_NAME, type SearchClient } from '#searchClient/index.js';
import type { ArrangerBaseContext, GraphQLEndpointOptions, RequestContextProps } from '#types.js';
import { addArrangerLocals, keepRequestContextView, requestStateOf } from '#utils/context.js';
import { FALLBACK_LABEL, isFallbackLabel, logSeparator } from '#utils/label.js';
import { maxAliasesRule, maxDepthRule } from '#utils/queryValidation.js';
import { SERVER_PROBLEM_MESSAGE } from '#utils/serverProblem.js';

export { FALLBACK_LABEL, isFallbackLabel, logSeparator };

/** Wraps a schema/endpoint-build failure with the marker `classifyCatalogueFailureReason` recognizes, preserving the original error as `cause`. */
const schemaBuildError = (message: string, cause: unknown): Error =>
	Object.assign(new Error(message, { cause }), { name: SCHEMA_BUILD_ERROR_NAME });

// TODO: Fix types once SearchClient response types are merged
const getTypesWithMappings = async <Context extends ArrangerBaseContext>({
	configs,
	enableDebug,
	label,
	mappingFromIndex,
	setsIndex,
}: {
	enableDebug: boolean;
	/** Identifies this catalogue in log output, so concurrent multicatalogue loads are distinguishable. */
	label?: string;
	mappingFromIndex: any;
	configs: ConfigsObject<Context>;
	/** The catalogue's own sets index, where every read path looks up a saved set. */
	setsIndex: string;
}) => {
	if (Object.keys(configs).length > 0) {
		try {
			console.log(
				`  - Now creating a GraphQL mapping based on the index${isFallbackLabel(label) ? '' : ` for "${label}"`}:`,
			);

			const fieldsFromMapping = flattenMappingToFields(mappingFromIndex);

			// Field names are sanitized into valid GraphQL identifiers below (see graphqlNameRegistry.ts);
			// the one thing sanitization can't resolve on its own is two distinct raw fields colliding on
			// the same sanitized name.
			const graphqlNameRegistry = buildGraphqlNameRegistry({
				documentType: configs?.[configRootProperties.DOCUMENT_TYPE],
				fieldsFromMapping,
			});

			if (graphqlNameRegistry.collisions.length > 0) {
				const details = graphqlNameRegistry.collisions
					.map(({ graphqlName, rawPaths }) => `\`${graphqlName}\`: ${rawPaths.join(', ')}`)
					.join('; ');
				throw schemaBuildError(
					`Two or more fields in this catalogue's mapping collide on the same GraphQL name: ${details}`,
					undefined,
				);
			}

			// Combines the mapping from ES with the "extended" custom configs
			const extendedFields = resolveExtendedFields({
				extendedConfigs: configs?.[configRootProperties.EXTENDED],
				label: label ?? FALLBACK_LABEL,
				mappingFields: fieldsFromMapping,
			});

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
					label,
					name: configs?.[configRootProperties.DOCUMENT_TYPE],
					setsIndex,
				},
				mapping: mappingFromIndex,
				registry: graphqlNameRegistry,
			});

			return {
				fieldsFromMapping,
				typesWithMappings,
			};
		} catch (error) {
			// A schema-build error thrown directly above (e.g. the invalid-name check) already carries
			// its own specific, actionable message; only wrap an error that isn't one of ours yet.
			if (error instanceof Error && error.name === SCHEMA_BUILD_ERROR_NAME) {
				throw error;
			}

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
 * Create the GQL schema based on type configuration and runtime flags.
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
}): { schema: GraphQLSchema; resolvers: IResolvers<any, Context> } => {
	const { resolvers, typesWithSets } = createCatalogueResolvers({
		debug: enableDebug,
		enableAdmin,
		getServerSideFilter,
		setsIndex,
		types,
	});

	return {
		schema: createSchemaForResolvers({
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

const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_SERVER_ERROR';

/** The code the router's own rule errors are answered with, which Apollo gives a request's own mistakes too. */
const BAD_USER_INPUT_CODE = 'BAD_USER_INPUT';

/** The codes Apollo gives a request's own mistakes, found before any resolver runs. */
const REQUEST_MISTAKE_CODES: ReadonlySet<string> = new Set([
	BAD_USER_INPUT_CODE,
	'GRAPHQL_PARSE_FAILED',
	'GRAPHQL_VALIDATION_FAILED',
	'PERSISTED_QUERY_NOT_FOUND',
	'PERSISTED_QUERY_NOT_SUPPORTED',
]);

/** Apollo's own fixed answers to a request it cannot run as an operation, which it raises with no code of their own. */
const APOLLO_REQUEST_MISTAKE_MESSAGES: ReadonlySet<string> = new Set([
	'GraphQL operations must contain a non-empty `query` or a `persistedQuery` extension.',
	'Operation batching disabled.',
	'provided sha does not match query',
]);

// graphql-js appends "Did you mean ...?" field-name suggestions to validation errors on a separate code path
// from introspection, so they would describe the schema even when disableGraphQLIntrospection is true.
// TODO: evaluate whether this is needed after switching away from Apollo
const FIELD_SUGGESTION_SUFFIX = / Did you mean .+\?$/i;

/** The code Apollo gave `error`, or the internal-error code where it holds none that is text. */
const codeOf = (error: GraphQLError): string => {
	const code = error.extensions?.code;

	return typeof code === 'string' ? code : INTERNAL_SERVER_ERROR_CODE;
};

const isRequestMistake = (error: GraphQLError): boolean =>
	REQUEST_MISTAKE_CODES.has(codeOf(error)) ||
	(error.path === undefined && APOLLO_REQUEST_MISTAKE_MESSAGES.has(error.message));

/**
 * The formatted error a client is given: built from scratch, never spread from `error`, so it holds its message,
 * the error's locations and path where it has them, and the code alone. Apollo hands this hook errors that are
 * not all GraphQLErrors with a working `toJSON` (the batching-disabled rejection is a plain Error), so only the
 * fields Apollo has already normalized onto `error` are read.
 */
const answerWith = ({
	code,
	error,
	message,
}: {
	code: string;
	error: GraphQLError;
	message: string;
}): GraphQLFormattedError => ({
	extensions: { code },
	...(error.locations && { locations: error.locations }),
	message,
	...(error.path && { path: error.path }),
});

const maskAccessControlError = (error: GraphQLError, accessControlError: AccessControlError): GraphQLFormattedError => {
	console.error('access_control.evaluation_failed', accessControlError.message, {
		cause: accessControlError.cause,
		path: error.path,
	});

	return answerWith({
		code: codeOf(error),
		error,
		message: ACCESS_CONTROL_FAILURE_MESSAGE,
	});
};

const answerQueryTooLarge = (error: GraphQLError, tooLarge: AccessControlQueryTooLargeError): GraphQLFormattedError => {
	console.error('access_control.query_too_large', {
		catalogue: tooLarge.catalogue,
		clauseLimit: tooLarge.clauseLimit,
		path: error.path,
		readPath: tooLarge.readPath,
	});

	return answerWith({ code: ACCESS_CONTROL_QUERY_TOO_LARGE_CODE, error, message: tooLarge.message });
};

// A request's own mistake keeps its message, which graphql-js, Apollo or the router's rules write without the
// server's detail. A rule's own detail, such as which part of a filter broke it, is its cause, logged only.
const answerRequestMistake = ({
	cause,
	code,
	error,
}: {
	cause?: unknown;
	code: string;
	error: GraphQLError;
}): GraphQLFormattedError => {
	const message = error.message.replace(FIELD_SUGGESTION_SUFFIX, '');

	console.info('graphql.invalid_request', { ...(cause !== undefined && { cause }), code, message, path: error.path });

	return answerWith({ code, error, message });
};

const answerServerProblem = (error: GraphQLError, label?: string): GraphQLFormattedError => {
	console.error('graphql.failed', error.originalError ?? error, {
		...(label && { catalogue: label }),
		path: error.path,
	});

	return answerWith({
		code: codeOf(error),
		error,
		message: SERVER_PROBLEM_MESSAGE,
	});
};

const answerFor = (error: GraphQLError, label?: string): GraphQLFormattedError => {
	// Widened, so each check narrows it on its own: every refusal class has Error's shape.
	const originalError: unknown = error.originalError;

	if (isAccessControlQueryTooLargeError(originalError)) {
		return answerQueryTooLarge(error, originalError);
	}

	if (isAccessControlError(originalError)) {
		return maskAccessControlError(error, originalError);
	}

	if (isInvalidFilterError(originalError)) {
		return answerRequestMistake({ cause: originalError.cause, code: BAD_USER_INPUT_CODE, error });
	}

	if (isRequestMistake(error)) {
		return answerRequestMistake({ code: codeOf(error), error });
	}

	return answerServerProblem(error, label);
};

/**
 * Apollo's error formatter for one catalogue's endpoint. A formatter that throws is answered by Apollo with the
 * thrown error itself, so a failure here is answered as a problem on the server too.
 *
 * @param label the catalogue's label, naming it in the server log.
 */
const formatErrorFor =
	(label?: string) =>
	(error: GraphQLError): GraphQLFormattedError => {
		try {
			return answerFor(error, label);
		} catch (formattingError) {
			console.error('graphql.format_failed', formattingError, { ...(label && { catalogue: label }) });

			return { extensions: { code: INTERNAL_SERVER_ERROR_CODE }, message: SERVER_PROBLEM_MESSAGE };
		}
	};

export const createEndpoint = async <Context extends ArrangerBaseContext>({
	disableClientFilters = false,
	disableGraphQLIntrospection,
	disablePlayground,
	enableDebug,
	enableGraphQLBatching = false,
	esClient,
	graphqlOptions = {},
	label,
	maxAliases,
	maxDepth,
	schema,
}: {
	disableClientFilters?: boolean;
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
	schema: GraphQLSchema;
}) => {
	const mainPath = '/graphql';
	const router = Router();

	console.log(`\n${logSeparator(label)}\nStarting GraphQL server${isFallbackLabel(label) ? '' : ` for "${label}"`}:`);

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

				// The request's state comes first, so a filter callback reads what an application recorded in
				// res.locals before the router here as it does on the export path, and the keys after it take precedence.
				return {
					...requestStateOf(res.locals),
					esClient,
					request,
					...(externalContext || {}),

					// After the spread: an external context must not be able to switch this off.
					disableClientFilters,
				};
			};

			// TODO: context type mismatch
			const apolloServer = new ApolloServer({
				allowBatchedHttpRequests: enableGraphQLBatching,
				cache: 'bounded',
				context: ({ req, res, con }) => buildContext(req, res, con),
				formatError: formatErrorFor(label),
				introspection: !disableGraphQLIntrospection,
				schema,
				validationRules,
				...apolloFeatureFlags,
			});

			await apolloServer.start();

			// TODO: invalid types between router and the app expected by apolloServer. Works as is but types are not valid.
			apolloServer.applyMiddleware({
				app: router,
				// The app already enforces its own CORS policy (see apps/search-server/src/server.ts);
				// Apollo's own default here would layer a second, permissive policy on top, disagreeing
				// with (and undermining) whatever origin restriction the app configured.
				cors: false,
				path: mainPath,
			});

			console.log(`  - GraphQL endpoint running at ...${mainPath}`);
			console.log(`  - GraphQL playground available at ...${mainPath}`);
		} else {
			router.use(mainPath, noSchemaHandler(mainPath));
		}
	} catch (err) {
		enableDebug && console.debug(`  DEBUG${isFallbackLabel(label) ? '' : ` (${label})`}: ${err}`);
		throw schemaBuildError('Something went wrong while starting the GraphQL endpoint', err);
	}

	router.use(
		'/',
		addArrangerLocals({
			schema,
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
	assertFilterCallback({ getServerSideFilter, receiver: 'createSchemasFromConfigs' });

	try {
		if (!configs) {
			throw new Error('  No configs were provided. Please provide a config object.');
		}

		const { fieldsFromMapping, typesWithMappings } = await getTypesWithMappings<Context>({
			configs,
			enableDebug,
			label,
			mappingFromIndex,
			setsIndex,
		});

		const { schema, resolvers } = await createSchema({
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
				getServerSideFilter,
				remoteNodeConfigs: networkConfigsObj[configArrangerNetworkProperties.REMOTE_NODES] ?? [],
				localNodeConfigs,
				localCatalogues,
			});
			if (networkSchemaResult.success) {
				schemasToMerge.push(networkSchemaResult.data);
			} else {
				console.error(
					`Error creating network schema for catalogue ${configs.catalogId}: ${networkSchemaResult.case}. No network search can be added to the GQL schema.`,
				);
			}
		}

		const fullSchema = mergeSchemas({ schemas: schemasToMerge });

		console.log(`\n  Success!${isFallbackLabel(label) ? '' : ` ("${label}")`}`);

		return {
			fieldsFromMapping,
			typesWithMappings,
			schema: fullSchema,
		};
	} catch (error: unknown) {
		// A schema-build error thrown deeper down (e.g. getTypesWithMappings' invalid-name check)
		// already carries its own specific message; only wrap an error that isn't one of ours yet.
		// Not logged here: router.ts's own catch already prints the full error (message, cause
		// chain, stack) behind enableDebug, and the curated code/message summary always logs once
		// further up, in apps/search-server; repeating it at every intermediate layer was just noise.
		if (error instanceof Error && error.name === SCHEMA_BUILD_ERROR_NAME) {
			throw error;
		}

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
	// Ahead of the try, so even with rethrowOnError off an unusable filter fails the build instead of
	// turning into a handler that answers every request with a 500.
	assertFilterCallback({ getServerSideFilter, receiver: 'getGraphQLRoutes' });

	// TODO: surfacing this variable to be reused later
	const setsIndex = configs[configOptionalProperties.SETS]?.index || fallbackConfigs.sets.index;

	try {
		const { fieldsFromMapping, schema, typesWithMappings } = await createSchemasFromConfigs({
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
			disableClientFilters: configs[configOptionalProperties.DISABLE_FILTERS] ?? false,
			disableGraphQLIntrospection: configs[configOptionalProperties.DISABLE_GRAPHQL_INTROSPECTION] ?? false,
			disablePlayground: configs[configOptionalProperties.DISABLE_GRAPHQL_PLAYGROUND] ?? false,
			enableDebug,
			enableGraphQLBatching: configs[configOptionalProperties.ENABLE_GRAPHQL_BATCHING] ?? false,
			esClient,
			graphqlOptions,
			label,
			maxAliases: configs[configOptionalProperties.GRAPHQL_MAX_ALIASES],
			maxDepth: configs[configOptionalProperties.GRAPHQL_MAX_DEPTH],
			schema,
		});

		try {
			await initializeSets({
				enableSets: configs[configFeatureFlagProperties.ENABLE_SETS] ?? false,
				enableDebug,
				esClient,
				label,
				setsIndex,
			});
		} catch (setsError) {
			const message = setsError instanceof Error ? setsError.message : `${setsError}`;
			console.error(
				`\n${logSeparator(label)}\nSets initialization failed: ${message}\nThe catalogue endpoint will continue without Sets support.`,
			);
		}

		return [
			// Makes the catalogue's configuration and search client available to every read path, under
			// res.locals.arranger, with req.context kept as a view of it for routes built without the router.
			keepRequestContextView,
			addArrangerLocals({
				configs: typesWithMappings?.[1],
				esClient,
				fieldsFromMapping,
			}),
			graphQLEndpoints,
		];
	} catch (error) {
		const message = error instanceof Error ? error.message : `${error}`;

		if (rethrowOnError) {
			// router.ts's own catch already prints the full error (message, cause chain, stack)
			// behind enableDebug, and the curated code/message summary always logs once further up,
			// in apps/search-server; nothing more to log here.
			throw error;
		}

		// With rethrowOnError off (the default for a direct getGraphQLRoutes caller), nothing further
		// up the chain ever sees this failure, the caller only gets the 500 response below, so this
		// is the only place it's ever visible server-side.
		console.info(
			`\n${logSeparator(label)}\nError thrown while generating the GraphQL endpoints${isFallbackLabel(label) ? '' : ` for "${label}"`}.`,
		);
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
