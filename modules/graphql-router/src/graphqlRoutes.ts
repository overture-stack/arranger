// TODO: for TS, we'll have to update "apollo-server-express" (which relies on graphql updates too)
import { mergeSchemas } from '@graphql-tools/schema';
import {
	configOptionalProperties,
	configRootProperties,
	setsProperties,
} from '@overture-stack/arranger-types/configs/constants';
import { ApolloServerPluginLandingPageDisabled } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-express';
import { Router } from 'express';

import { initializeSets } from './config/index.js';
import { extendCharts } from './mapping/extendCharts.js';
import { extendColumns, extendFacets, flattenMappingToFields } from './mapping/extendMapping.js';
import { addMappingsToTypes, extendFields, fetchMapping } from './mapping/index.js';
import { createSchemaFromNetworkConfig } from './network/index.js';
import makeSchema from './schema/index.js';
import { addContext } from './utils/context.js';

const getESMapping = async ({ enableDebug, esClient, esIndex }) => {
	if (esClient && esIndex) {
		const { mapping } = await fetchMapping({
			enableDebug,
			esClient,
			esIndex,
		});

		if (Object.hasOwn(mapping, 'id')) {
			// FIXME: Figure out a solution to map this to something else rather than dropping it
			enableDebug &&
				console.debug('    DEBUG: Detected reserved field "id" in mapping, dropping it from GraphQL...');
			delete mapping.id;
		}
		return mapping;
	}

	throw new Error(`  Could not get ES mappings for ${esIndex}`);
};

const getTypesWithMappings = async ({ enableDebug, mappingFromES, configs = {} }) => {
	if (Object.keys(configs).length > 0) {
		try {
			console.log('  - Now creating a GraphQL mapping based on the ES index:');

			const fieldsFromMapping = await flattenMappingToFields(mappingFromES);

			// Combines the mapping from ES with the "extended" custom configs
			const extendedFields = await (async () => {
				try {
					return extendFields(fieldsFromMapping, configs?.[configRootProperties.EXTENDED]);
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
					return extendFacets(configs?.[configRootProperties.FACETS], extendedFields);
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
					return extendColumns(configs?.[configRootProperties.TABLE], extendedFields);
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
				mapping: mappingFromES,
			});

			return {
				fieldsFromMapping,
				typesWithMappings,
			};
		} catch (error) {
			console.error(error?.message || error);
			throw '  Something went wrong while creating the GraphQL mapping';
		}
	}

	throw new Error('  No configs available at getTypesWithMappings');
};

const createSchema = async ({
	enableDebug,
	enableAdmin,
	getServerSideFilter,
	graphqlOptions = {},
	setsIndex,
	types,
}) => {
	const schemaBase = {
		getServerSideFilter,
		rootTypes: [],
		setsIndex,
		types,
	};

	return {
		...(types && {
			mockSchema: makeSchema({
				enableDebug,
				enableAdmin,
				mock: true,
				...schemaBase,
			}),
			schema: makeSchema({
				enableDebug,
				enableAdmin,
				middleware: graphqlOptions.middleware || [],
				...schemaBase,
			}),
		}),
	};
};

const noSchemaHandler =
	(endpoint = 'unspecified') =>
	(req, res) => {
		console.log(`  - Something went wrong initialising a GraphQL endpoint: ${endpoint}`);

		return res.json({
			error: 'Schema is undefined. Make sure your server has a valid GraphQL Schema.',
		});
	};

export const createEndpoint = async ({
	disablePlayground,
	enableDebug,
	esClient,
	graphqlOptions = {},
	mockSchema,
	schema,
}) => {
	const mainPath = '/graphql';
	const mockPath = '/mock/graphql';
	const router = Router();

	console.log('\n------\nStarting GraphQL server:');

	const apolloFeatureFlags = disablePlayground && { plugins: [ApolloServerPluginLandingPageDisabled()] };

	try {
		// TODO: D.R.Y this thing!

		if (schema) {
			const buildContext = async (req, res, connection) => {
				const externalContext =
					typeof graphqlOptions.context === 'function'
						? await graphqlOptions.context(req, res, connection)
						: graphqlOptions.context;

				return {
					esClient,
					...(externalContext || {}),
				};
			};

			const apolloServer = new ApolloServer({
				cache: 'bounded',
				context: ({ req, res, con }) => buildContext(req, res, con),
				schema,
				...apolloFeatureFlags,
			});

			await apolloServer.start();

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

export const createSchemasFromConfigs = async ({
	configs,
	enableDebug,
	enableAdmin,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
	setsIndex,
}) => {
	try {
		if (!configs) {
			throw new Error('  No configs were provided. Please provide a config object.');
		}

		const mappingFromES = await getESMapping({
			enableDebug,
			esClient,
			esIndex: configs[configRootProperties.ES_INDEX],
		});
		const { fieldsFromMapping, typesWithMappings } = await getTypesWithMappings({
			configs,
			enableDebug,
			mappingFromES,
		});

		const commonFields = { fieldsFromMapping, typesWithMappings };

		const { mockSchema, schema } = await createSchema({
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
		if (networkConfigsObj.length >= 1) {
			enableDebug &&
				console.debug(
					'    DEBUG: `nodes` config provided for network aggregation. Adding network search to the gql schema...',
				);
			const remoteServerConfigs = networkConfigsObj.map((config) => ({
				...config,
				/*
				 * part of the gql schema is generated dynamically
				 * in the case of the "file" field, the field name and gql type name are the same
				 */
				documentName: config.documentType,
			}));
			const networkSchemaResult = await createSchemaFromNetworkConfig({
				networkConfigs: remoteServerConfigs,
			});
			if (networkSchemaResult.success) {
				schemasToMerge.push(networkSchemaResult.data);
			}
		}

		const fullSchema = mergeSchemas({ schemas: schemasToMerge });

		console.log('\n  Success!');

		return {
			...commonFields,
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

export default async ({ configs, enableDebug, enableAdmin, esClient, getServerSideFilter, graphqlOptions = {} }) => {
	// TODO: surfacing this variable to be reused later
	const { index: setsIndex } = configs[configOptionalProperties.SETS];

	try {
		const { fieldsFromMapping, mockSchema, schema, typesWithMappings } = await createSchemasFromConfigs({
			configs,
			enableDebug,
			enableAdmin,
			esClient,
			getServerSideFilter,
			graphqlOptions,
			setsIndex,
		});

		const graphQLEndpoints = await createEndpoint({
			disablePlayground: configs[configOptionalProperties.DISABLE_GRAPHQL_PLAYGROUND],
			enableDebug,
			esClient,
			graphqlOptions,
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
