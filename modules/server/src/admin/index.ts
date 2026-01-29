// import { IResolversParameter } from 'graphql-tools';
import { addMocksToSchema } from '@graphql-tools/mock';
import { mergeSchemas } from '@graphql-tools/schema';
import { ApolloServer } from 'apollo-server-express';
import { type GraphQLSchema } from 'graphql';
import { print } from 'graphql/language/printer';

import { type SearchClientType } from '../searchClient/index.js';

import {
	createAggsStateByIndexResolver,
	createColumnsStateByIndexResolver,
	createExtendedMappingsByIndexResolver,
	createIndexByProjectResolver,
	createIndicesByProjectResolver,
	createMatchBoxStateByIndexResolver,
} from './resolvers.js';
import { createSchema as createAggsStateSchema } from './schemas/AggsState/index.js';
import { createSchema as createColumnsStateSchema } from './schemas/ColumnsState/index.js';
import { createSchema as createExtendedMappingSchema } from './schemas/ExtendedMapping/index.js';
import { createSchema as createIndexSchema } from './schemas/IndexSchema/index.js';
import { createSchema as createMatchboxStateSchema } from './schemas/MatchboxState/index.js';
import { createSchema as createProjectSchema } from './schemas/ProjectSchema/index.js';
import mergedTypeDefs from './schemaTypeDefs.js';
import { constants } from './services/constants.js';
import { createClient as createElasticsearchClient } from './services/elasticsearch/index.js';
import { type AdminApiConfig, type IQueryContext } from './types.js';

const createSchema = async () => {
	const typeDefs = mergedTypeDefs;

	const projectSchema = await createProjectSchema();
	const aggsStateSchema = await createAggsStateSchema();
	const collumnsStateSchema = await createColumnsStateSchema();
	const extendedMappingShema = await createExtendedMappingSchema();
	const matchBoxStateSchema = await createMatchboxStateSchema();
	const indexSchema = await createIndexSchema();

	const mergedSchema = mergeSchemas({
		schemas: [
			projectSchema,
			indexSchema,
			aggsStateSchema,
			collumnsStateSchema,
			extendedMappingShema,
			matchBoxStateSchema,
			print(typeDefs) as unknown as GraphQLSchema, // TODO: this type coercion is smelly
		],
		resolvers: {
			Project: {
				index: createIndexByProjectResolver(indexSchema),
				indices: createIndicesByProjectResolver(indexSchema),
			},
			Index: {
				extended: createExtendedMappingsByIndexResolver(extendedMappingShema),
				columnsState: createColumnsStateByIndexResolver(collumnsStateSchema),
				aggsState: createAggsStateByIndexResolver(aggsStateSchema),
				matchBoxState: createMatchBoxStateByIndexResolver(matchBoxStateSchema),
			},
		},
	});
	addMocksToSchema({ schema: mergedSchema, preserveResolvers: true });
	return mergedSchema;
};

function buildElasticsearchClient(config: AdminApiConfig) {
	return createElasticsearchClient(config.esHost, config.esUser, config.esPass);
}

const initialize = (config: AdminApiConfig): Promise<SearchClientType> =>
	new Promise(async (resolve, reject) => {
		console.info('Initializing Elasticsearch Client for host: ' + config.esHost);
		const esClient = buildElasticsearchClient(config);
		try {
			console.info('Checking if index ' + constants.ARRANGER_PROJECT_INDEX + ' exists in Elasticsearch');
			const exists = await esClient.indices.exists({
				index: constants.ARRANGER_PROJECT_INDEX,
			});
			if (!exists) {
				esClient.indices.create({
					index: constants.ARRANGER_PROJECT_INDEX,
				});
			}
			resolve(esClient);
		} catch (err) {
			setTimeout(() => {
				initialize(config).then(() => resolve(esClient));
			}, 1000);
		}
	});

export default async (config: AdminApiConfig) => {
	const esClient = await initialize(config);
	return new ApolloServer({
		schema: await createSchema(),
		context: (): IQueryContext => ({
			es: esClient,
		}),
	});
};
