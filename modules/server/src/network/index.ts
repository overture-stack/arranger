import { buildClientSchema, getIntrospectionQuery, IntrospectionQuery } from 'graphql';
import { fetchGql } from './gql';
import { createNetworkAggregationSchema } from './schema';
import { NetworkAggregationConfig, NetworkAggregationConfigInput } from './types';

/**
 * WARNING: Unsafe type check, basically a type assertion. Do not export please.
 *
 * This is doing a cursory check that the response from a GQL Server appears to be a IntrospectionQuery object.
 * If this check passes we will optimistically treat the object as a GQL IntrospectionQuery.
 *
 * Should be used sparingly, and ideally all downstream consumers of the object operate within try/catch blocks.
 *
 * @param input
 * @returns
 */
const isGqlIntrospectionQuery = (input: unknown): input is IntrospectionQuery =>
	!!input && typeof input === 'object' && '__schema' in input && typeof input.__schema === 'object';

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
				console.error('unexpected response data in fetchRemoteSchema');
				throw Error('unexpected response data');
			}
		} else {
			console.error('network error in fetchRemoteSchema');
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
