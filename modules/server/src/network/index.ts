import { NetworkAggregationInterface } from '@/config/types';
import { buildClientSchema, print } from 'graphql';
import gql from 'graphql-tag';
import { fetchGql, getIntrospectionQuery } from './gql';

const REMOTE_SERVER_STATUS = {
	CONNECTED: 'connected',
	DISCONNECTED: 'disconnected',
} as const;

const toJSON = (resp) => resp.json(); // todo: util

// validate step
const validateField = (field) => {
	// todo: account for array eg. [Donor]
	// todo: nested types
	const value = field.type.name;
	return acceptedFieldTypes.includes(value);
};

const validateFields = (x) => x;

const fetchRemoteSchemas = async ({
	availableConnections,
}: {
	availableConnections: NetworkAggregationInterface[];
}) => {
	const schemas = await Promise.allSettled(
		availableConnections.map(async (config) => {
			const { graphqlUrl, documentType } = config;
			try {
				const remoteSchema = await fetchGql({
					url: graphqlUrl,
					gqlRequest: { query: getIntrospectionQuery() },
				})
					.then(toJSON)
					.then((schemaJSON) => buildClientSchema(schemaJSON.data));

				return remoteSchema;
			} catch (error) {
				console.log(`Failed to retrieve schema from url: ${config.graphqlUrl}`);
				console.error(error);
				throw error;
			}
		}),
	).then((schemaResults) =>
		schemaResults.map((result) => {
			const response = { id: '', schemaJSON: undefined, errors: undefined };
			if (result.status === 'fulfilled') {
				return { ...response, schemaJSON: result.value, errors: [] };
			} else {
				return { ...response, schemaJSON: null, errors: [result.reason] };
			}
		}),
	);

	console.log(schemas);
	return schemas;
};

const ping = (x) => x;

const everyAll = () => {};

const acceptedFieldTypes = ['Aggregations', 'NumericAggregations']; // todo: config
const config = { acceptedDocumentTypes: ['Aggregations', 'NumericAggregations'] };
export const createSchemaFromNetworkConfig = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationInterface[];
}) => {
	try {
		const availableConnections = await ping(networkConfig);
		const remoteSchemas: { id: string; schemaJSON: any } = await fetchRemoteSchemas({
			availableConnections,
			config: {},
		});
		console.log('r', remoteSchemas);
		//const m = mergeSchemas(remoteSchemasJSON);
	} catch (error) {}

	const schema = gql`
		{
			network
		}
	`;
};

// !TODO tricky with diff arranger versions
// node could have more fields, less fields etc
export const mergeSchemas = (s) => {
	s.reduce((acc, current) => {
		return { acc, ...current };
	}, {});
};
