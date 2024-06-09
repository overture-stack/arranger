import { buildClientSchema, getIntrospectionQuery, IntrospectionQuery } from 'graphql';
import { fetchGql } from './gql';
import { createNetworkAggregationSchema } from './schema';
import { NetworkAggregationConfig, NetworkAggregationConfigInput } from './types';
import { toJSON } from './util';

type FetchRemoteSchemaResult = {
	config: NetworkAggregationConfigInput;
	schemaJSON: IntrospectionQuery | null;
};
const fetchRemoteSchema = async (
	config: NetworkAggregationConfigInput,
): Promise<FetchRemoteSchemaResult> => {
	const { graphqlUrl } = config;
	try {
		/**
		 * get full schema (needed for buildClientSchema) and convert json
		 */
		const remoteSchema = await fetchGql({
			url: graphqlUrl,
			gqlRequest: { query: getIntrospectionQuery() },
		})
			.then(toJSON)
			.then((json) => json.data);

		return { config, schemaJSON: remoteSchema };
	} catch (error) {
		console.log(`Failed to retrieve schema from url: ${config.graphqlUrl}`);
		console.error(error);
		return { config, schemaJSON: null };
	}
};

const fetchRemoteSchemas = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationConfigInput[];
}): Promise<NetworkAggregationConfig[]> => {
	// network calls
	// type cast because rejected errors are handled
	const networkQueries = (await Promise.allSettled(
		networkConfig.map(async (config) => fetchRemoteSchema(config)),
	)) as PromiseFulfilledResult<FetchRemoteSchemaResult>[];

	// json => GqlObject(s)
	const schemaResults = networkQueries.map((networkResult) => {
		const { config, schemaJSON } = networkResult.value;
		try {
			const schema = schemaJSON !== null ? buildClientSchema(schemaJSON) : null;
			return { ...config, schema };
		} catch (error) {
			console.error('build schema error', error);
			return { ...config, schema: null };
		}
	});

	return schemaResults;
};

export const createSchemaFromNetworkConfig = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationConfigInput[];
}) => {
	const newtworkConfigs = await fetchRemoteSchemas({
		networkConfig,
	});

	const networkSchema = createNetworkAggregationSchema(newtworkConfigs);

	console.log(networkSchema);
	return { networkSchema };
};
