import { NetworkAggregationInterface } from '@/config/types';
import { buildClientSchema } from 'graphql';
import { fetchGql, getIntrospectionQuery } from './gql';
import { toJSON } from './util';

/**
 * 
network config:
		{
			"displayName": "Barc",
			"graphqlUrl": "http://localhost:7070/",
			"documentType": "Aggs"
		}
 */

const fetchRemoteSchemas = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationInterface[];
}) => {
	const networkQueries = await Promise.allSettled(
		networkConfig.map(async (config) => {
			const { graphqlUrl } = config;
			try {
				/**
				 * get full schema (needed for buildClientSchema) and convert json to gql object
				 */
				const remoteSchema = await fetchGql({
					url: graphqlUrl,
					gqlRequest: { query: getIntrospectionQuery() },
				})
					.then(toJSON)
					.then((schemaJSON) => buildClientSchema(schemaJSON.data));

				return { config, res: remoteSchema };
			} catch (error) {
				console.log(`Failed to retrieve schema from url: ${config.graphqlUrl}`);
				console.error(error);
				return { config, res: error };
			}
		}),
	);

	const schemaResults = networkQueries.map((networkResult) => {
		// responses need to be cleaned up
		const response = { id: '', schema: undefined, errors: undefined, config };
		if (networkResult.status === 'fulfilled') {
			return {
				...response,
				schema: networkResult.value.res,
				config: networkResult.value.config,
				errors: [],
			};
		} else {
			return { ...response, schema: null, config: null, errors: [networkResult.reason] };
		}
	});

	return schemaResults;
};

export const createSchemaFromNetworkConfig = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationInterface[];
}) => {
	try {
		// query remote nodes
		const remoteSchemasResult = await fetchRemoteSchemas({
			networkConfig,
		});

		// merge remote schemas
		const mergedFields = mergeRemoteSchemas(remoteSchemasResult);
	} catch (error) {
		console.log(error);
	}
};

const mergeRemoteSchemas = (remoteSchemasResult) => {
	// want to reuse config in here to pull out `documentType`
	// alternative is to it in as 2nd param to mergeRemoteSchemas
	// but then I have to link remoteSchemasResult.schema <===> networkConfig[node].documentType
};
