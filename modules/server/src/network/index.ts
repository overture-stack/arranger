import { buildClientSchema, getIntrospectionQuery, IntrospectionQuery } from 'graphql';
import { fetchGql } from './gql';
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
 * @throws Unexpected data error
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

		const jsonData = await response.json();

		if (jsonData && jsonData.data && isGqlIntrospectionQuery(jsonData.data)) {
			return { config, introspectionResult: jsonData };
		} else {
			throw Error('response data unexpected');
		}
	} catch (error) {
		console.log(`Failed to retrieve schema from url: ${config.graphqlUrl}`);
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
	// type cast because rejected errors are handled
	const networkQueries = (await Promise.allSettled(
		networkConfig.map(async (config) => fetchRemoteSchema(config)),
	)) as PromiseFulfilledResult<FetchRemoteSchemaResult>[];

	// build schema
	const schemaResults = networkQueries.map((networkResult) => {
		const { config, introspectionResult } = networkResult.value;

		try {
			if (introspectionResult) {
				throw Error('response data incorrect');
			}
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
	const remoteSchemasResult = await fetchRemoteSchemas({
		networkConfig,
	});

	const mergedFields = mergeRemoteSchemas(remoteSchemasResult);
};

const mergeRemoteSchemas = (input) => {
	/**placeholder */
};
