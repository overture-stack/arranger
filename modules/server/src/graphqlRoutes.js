// TODO: for TS, we'll have to update "apollo-server-express" (which relies on graphql updates too)
import { ApolloServer } from 'apollo-server-express';
import { Router } from 'express';
import expressPlayground from 'graphql-playground-middleware-express';

import getConfigObject, { initializeSets } from './config';
import { DEBUG_MODE, ES_PASS, ES_USER } from './config/constants';
import { ConfigProperties } from './config/types';
import { addMappingsToTypes, extendFields, fetchMapping } from './mapping';
import { extendColumns, extendFacets, flattenMappingToFields } from './mapping/extendMapping';
import makeSchema from './schema';

const getESMapping = async (esClient, index) => {
	if (esClient && index) {
		const { mapping } = await fetchMapping({
			esClient,
			index,
		});

		if (Object.hasOwn(mapping, 'id')) {
			// FIXME: Figure out a solution to map this to something else rather than dropping it
			DEBUG_MODE &&
				console.log('  Detected reserved field "id" in mapping, dropping it from GraphQL...');
			delete mapping.id;
		}

		console.log('  Success!\n');
		return mapping;
	}

	throw new Error(`Could not get ES mappings for ${index}`);
};

const getTypesWithMappings = async (mapping, configs = {}) => {
	if (Object.keys(configs).length > 0) {
		try {
			console.log('Now creating a GraphQL mapping based on the ES index:');

			const fieldsFromMapping = await flattenMappingToFields(mapping);

			// Combines the mapping from ES with the "extended" custom configs
			const extendedFields = await (async () => {
				try {
					return extendFields(fieldsFromMapping, configs?.[ConfigProperties.EXTENDED]);
				} catch (err) {
					console.log(
						'  Something happened while extending the ES mappings.\n' +
							'  Defaulting to "extended" config from files.\n',
					);
					DEBUG_MODE && console.log(err);

					return configs?.[ConfigProperties.EXTENDED] || [];
				}
			})();

			// Uses the "extended" fields to enhance the "facets" custom configs
			const extendedFacetsConfigs = await (async () => {
				try {
					return extendFacets(configs?.[ConfigProperties.FACETS], extendedFields);
				} catch (err) {
					console.log(
						'  Something happened while extending the column mappings.\n' +
							'  Defaulting to "table" config from files.\n',
					);
					DEBUG_MODE && console.log(err);

					return configs?.[ConfigProperties.TABLE] || [];
				}
			})();

			// Uses the "extended" fields to enhance the "table" custom configs
			const extendedTableConfigs = await (async () => {
				try {
					return extendColumns(configs?.[ConfigProperties.TABLE], extendedFields);
				} catch (err) {
					console.log(
						'  Something happened while extending the column mappings.\n' +
							'  Defaulting to "table" config from files.\n',
					);
					DEBUG_MODE && console.log(err);

					return configs?.[ConfigProperties.TABLE] || [];
				}
			})();

			const typesWithMappings = addMappingsToTypes({
				graphQLType: {
					index: configs?.[ConfigProperties.INDEX],
					name: configs?.[ConfigProperties.DOCUMENT_TYPE],
					extendedFields,
					customFields: '',
					config: {
						...configs,
						[ConfigProperties.FACETS]: extendedFacetsConfigs,
						[ConfigProperties.TABLE]: extendedTableConfigs,
					},
				},
				mapping,
			});

			console.log('  Success!\n');
			return {
				fieldsFromMapping,
				typesWithMappings,
			};
		} catch (error) {
			console.error(error?.message || error);
			throw `  Something went wrong while creating the GraphQL mapping${
				ES_USER && ES_PASS
					? ', this needs research by an Arranger maintainer!'
					: '.\n  Likely cause: ES Auth parameters may be missing.'
			}`;
		}
	}

	throw Error('  No configs available at getTypesWithMappings');
};

const createSchema = async ({
	enableAdmin,
	enableAggregationMode,
	getServerSideFilter,
	graphqlOptions = {},
	types,
}) => {
	const schemaBase = {
		getServerSideFilter,
		rootTypes: [],
		types,
	};

	return {
		...(types && {
			mockSchema: makeSchema({
				mock: true,
				...schemaBase,
			}),
			schema: makeSchema({
				enableAdmin,
				enableAggregationMode,
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

const createEndpoint = async ({ esClient, graphqlOptions = {}, mockSchema, schema }) => {
	const mainPath = '/graphql';
	const mockPath = '/mock/graphql';
	const router = Router();

	console.log('Starting GraphQL server:');

	try {
		await router.get(
			mainPath,
			expressPlayground({
				endpoint: 'graphql',
			}),
		);

		console.log(`  - GraphQL playground available at ...${mainPath}`);

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
				schema,
				context: ({ req, res, con }) => buildContext(req, res, con),
			});

			await apolloServer.start();

			apolloServer.applyMiddleware({
				app: router,
				path: mainPath,
			});

			console.log(`  - GraphQL endpoint running at ...${mainPath}`);
		} else {
			router.use(mainPath, noSchemaHandler(mainPath));
		}

		if (mockSchema) {
			const apolloMockServer = new ApolloServer({
				cache: 'bounded',
				schema: mockSchema,
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

		console.log('  Success!\n');
	} catch (err) {
		DEBUG_MODE && console.error(err);
		// TODO: Throw better?
		throw err;
	}

	router.use('/', (req, res, next) => {
		// this middleware makes the esClient available in all requests in a "context"
		req.context.schema = schema;
		req.context.mockSchema = mockSchema;

		return next();
	});

	return router;
};

export const createSchemasFromConfigs = async ({
	configsSource = '',
	enableAdmin,
	enableAggregationMode,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
}) => {
	try {
		const configsFromFiles = await getConfigObject(configsSource);
		const mappingFromES = await getESMapping(esClient, configsFromFiles[ConfigProperties.INDEX]);
		const { fieldsFromMapping, typesWithMappings } = await getTypesWithMappings(
			mappingFromES,
			configsFromFiles,
		);

		const { mockSchema, schema } = await createSchema({
			enableAdmin,
			enableAggregationMode,
			getServerSideFilter,
			graphqlOptions,
			types: typesWithMappings,
		});

		return {
			fieldsFromMapping,
			mockSchema,
			schema,
			typesWithMappings,
		};
	} catch (error) {
		const message = error?.message || error;
		console.info('\n------\nError thrown while creating the GraphQL schemas.');
		console.error(message);

		throw '  Something went wrong while creating the GraphQL schemas';
	}
};

export default async ({
	configsSource = '',
	enableAdmin,
	enableAggregationMode,
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
}) => {
	try {
		const { fieldsFromMapping, mockSchema, schema, typesWithMappings } =
			await createSchemasFromConfigs({
				configsSource,
				enableAdmin,
				enableAggregationMode,
				esClient,
				getServerSideFilter,
				graphqlOptions,
			});

		const graphQLEndpoints = await createEndpoint({
			esClient,
			graphqlOptions,
			mockSchema,
			schema,
		});

		await initializeSets({ esClient });

		return [
			// this middleware makes the esClient and config available in all requests, in a "context" object
			(req, res, next) => {
				req.context = {
					...req.context,
					configs: typesWithMappings?.[1],
					esClient,
					fieldsFromMapping,
				};

				return next();
			},
			graphQLEndpoints,
		];
	} catch (error) {
		const message = error?.message || error;
		// if enpoint creation fails, follow to the next server step to respond with an error
		console.info('\n------\nError thrown while generating the GraphQL endpoints.');
		console.error(message);

		return (req, res) =>
			res.status(500).send({
				// TODO: revisit this response
				error: 'The GraphQL server is unavailable due to an internal error',
				message: message?.trim?.() || 'Please notify the systems admin - ',
			});
	}
};
