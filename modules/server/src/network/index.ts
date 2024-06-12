import { buildClientSchema, getIntrospectionQuery, IntrospectionQuery } from 'graphql';
import { fetchGql } from './gql';
import { createNetworkAggregationSchema } from './schema';
import { NetworkAggregationConfig, NetworkAggregationConfigInput } from './types';

const isGqlIntrospectionQuery = (input: any): input is IntrospectionQuery => {
	return (input as IntrospectionQuery).__schema !== undefined;
};

type FetchRemoteSchemaResult = {
	config: NetworkAggregationConfigInput;
	introspectionResult: IntrospectionQuery | null;
};

/**
 *
 * @param config - network config from env
 * @returns a promise containing network config and the introspection query result
 *
 * @throws Fetch failed error
 *
 * @throws JSON parse error
 *
 * @throws Unexpected data error eg. Not a valid introspectionQuery result
 */
const fetchRemoteSchema = async (
	config: NetworkAggregationConfigInput,
): Promise<FetchRemoteSchemaResult> => {
	const { graphqlUrl } = config;
	try {
		/**
		 * get full schema (needed for buildClientSchema) and convert json
		 */
		const response = await fetchGql({
			url: graphqlUrl,
			gqlRequest: { query: getIntrospectionQuery() },
		});

		if (response.status === 200 && response.statusText === 'OK') {
			// axios response "data" field, graphql response "data" field
			const responseData = response.data?.data;
			if (isGqlIntrospectionQuery(responseData)) {
				return { config, introspectionResult: responseData };
			} else {
				throw Error('response data unexpected');
			}
		} else {
			throw Error('network error');
		}
	} catch (error) {
		console.log(`failed to retrieve schema from url: ${config.graphqlUrl}`);
		console.error(error);
		return { config, introspectionResult: null };
	}
};

const fetchRemoteSchemas = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationConfigInput[];
}): Promise<NetworkAggregationConfig[]> => {
	// query remote notes
	const networkQueryPromises = networkConfig.map(async (config) => fetchRemoteSchema(config));
	// type cast because rejected errors are handled
	const networkQueries = (await Promise.allSettled(
		networkQueryPromises,
	)) as PromiseFulfilledResult<FetchRemoteSchemaResult>[];

	// json => GqlObject(s)
	const schemaResults = networkQueries.map((networkResult) => {
		const { config, introspectionResult } = networkResult.value;

		try {
			const schema = introspectionResult !== null ? buildClientSchema(introspectionResult) : null;
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
