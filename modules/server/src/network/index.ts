import { NetworkAggregationInterface } from '@/config/types';
import { buildClientSchema, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { GraphQLNonEmptyString } from 'graphql-scalars';
import { fetchGql, getIntrospectionQuery } from './gql';
import { toJSON } from './util';

const validateField = (field) => {
	// todo: account for array eg. [Donor]
	const value = field.type.name;
	return acceptedFieldTypes.includes(value);
};

const validateFields = (x) => x;

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

	console.log(schemaResults);
	return schemaResults;
};

const acceptedFieldTypes = ['Aggregations', 'NumericAggregations']; // todo: config
const config = { acceptedDocumentTypes: ['Aggregations', 'NumericAggregations'] };
export const createSchemaFromNetworkConfig = async ({
	networkConfig,
}: {
	networkConfig: NetworkAggregationInterface[];
}) => {
	try {
		/**
		 * Query remote nodes for schema
		 */
		const remoteSchemasResult = await fetchRemoteSchemas({
			networkConfig,
			config: {},
		});

		/**
		 * Merge remote schemas
		 */
		const mergedFields = remoteSchemasResult.filter((s) => s.schema).reduce(mergeSchemas, {});

		// this root of merged fields, needs to be wrapped in GraphObjectType also
		// formatted correctly to construct schema
		const xxx = new GraphQLObjectType({
			name: 'network',
			fields: mergedFields,
		});

		const otherSchema = new GraphQLSchema({
			query: xxx,
		});
		console.log('network schema', otherSchema);
	} catch (error) {
		//TOOD handle remote schemas not working

		console.log(error);
	}
};

export const mergeSchemas = (acc, schema) => {
	const documentType = schema.config.documentType;
	console.log('sc', schema.schema);
	const fields = schema.schema['_typeMap'][documentType]['_fields'];
	return Object.entries(fields).reduce((acc, [key, value]) => {
		return { ...acc, [key]: { type: GraphQLNonEmptyString } };
	}, {});
};
