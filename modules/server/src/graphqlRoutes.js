// TODO: for TS, we'll have to update "apollo-server-express" (which relies on graphql updates too)
import { ApolloServer } from 'apollo-server-express';
import { Router } from 'express';
import expressPlayground from 'graphql-playground-middleware-express';

import getConfigObject, { initializeSets } from './config';
import { DEBUG_MODE, ES_USER, ES_PASS } from './config/constants';
import { ConfigProperties } from './config/types';
import { addMappingsToTypes, extendFields, fetchMapping } from './mapping';
import { extendColumns, extendFacets } from './mapping/extendMapping';
import makeSchema from './schema';

const getTypesWithMappings = async (esClient, configs = {}) => {
	if (Object.keys(configs).length > 0) {
		try {
			console.log('Now creating a GraphQL mapping based on the ES index:');
			const { mapping } = await fetchMapping({
				esClient,
				index: configs?.[ConfigProperties.INDEX],
			});

			if (mapping) {
				if (Object.hasOwn(mapping, 'id')) {
					// FIXME: Figure out a solution to map this to something else rather than dropping it
					console.log('Detected reserved field "id" in mapping, dropping it from GraphQL...');
					delete mapping.id;
				}
				// Combines the mapping from ES with the "extended" custom configs
				const extendedFields = await (async () => {
					try {
						return extendFields(mapping, configs?.[ConfigProperties.EXTENDED]);
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

				const typesWithMapping = addMappingsToTypes({
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
				return typesWithMapping;
			}

			// We should never see this log, else there may be a bug in `fetchMapping`
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

const createSchema = async ({ enableAdmin, getServerSideFilter, graphqlOptions = {}, types }) => {
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
				middleware: graphqlOptions.middleware || [],
				...schemaBase,
			}),
		}),
	};
};

const createEndpoint = async ({ esClient, graphqlOptions = {}, mockSchema, schema }) => {
	const router = Router();

	const noSchemaHandler = (req, res) => {
		console.log('Something went wrong initialising a GraphQL endpoint');

		return res.json({
			error: 'schema is undefined. Make sure you provide a valid GraphQL Schema.',
		});
	};

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

		console.log('Starting GraphQL server:');

		const apolloServer = new ApolloServer({
			cache: 'bounded',
			schema,
			context: ({ req, res, con }) => buildContext(req, res, con),
		});

		await apolloServer.start();

		apolloServer.applyMiddleware({
			app: router,
			path: '/graphql',
		});

		console.log('  GraphQL server running at .../graphql');
		console.log('  Success!');
	} else {
		router.use('/graphql', noSchemaHandler);
	}

	if (mockSchema) {
		console.log('\nStarting GraphQL mock server:');

		const apolloMockServer = new ApolloServer({
			cache: 'bounded',
			schema: mockSchema,
		});

		await apolloMockServer.start();

		apolloMockServer.applyMiddleware({
			app: router,
			path: '/mock/graphql',
		});

		console.log('  GraphQL mock server running at .../mock/graphql');
		console.log('  Success!');
	} else {
		router.use('/mock/graphql', noSchemaHandler);
	}

	router.get(
		'/graphql',
		expressPlayground({
			endpoint: 'graphql',
		}),
	);

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
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
}) => {
	try {
		const configsFromFiles = await getConfigObject(configsSource);
		const typesWithMappings = await getTypesWithMappings(esClient, configsFromFiles);

		const { mockSchema, schema } = await createSchema({
			enableAdmin,
			getServerSideFilter,
			graphqlOptions,
			types: typesWithMappings,
		});

		return {
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
	esClient,
	getServerSideFilter,
	graphqlOptions = {},
}) => {
	try {
		const { mockSchema, schema, typesWithMappings } = await createSchemasFromConfigs({
			configsSource,
			enableAdmin,
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

		console.log('\n');

		return [
			// this middleware makes the esClient and config available in all requests, in a "context" object
			(req, res, next) => {
				req.context = {
					...req.context,
					configs: typesWithMappings?.[1],
					esClient,
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
