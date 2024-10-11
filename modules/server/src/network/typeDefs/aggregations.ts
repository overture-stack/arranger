import {
	GraphQLBoolean,
	GraphQLInt,
	GraphQLList,
	GraphQLObjectType,
	GraphQLSchema,
	GraphQLString,
} from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import { SupportedNetworkFieldType } from '../types';
import { singleToNetworkAggregationMap } from './networkAggregations';

/**
 * Converts field/types to GQLObjectType definition shape
 *
 * @example
 * { name: "donor_age", type: "NumericAggregations" } => { donor_age: { type: "NetworkNumericAggregations" } }
 */
const convertToGQLObjectType = (networkFieldTypes) => {
	return networkFieldTypes.reduce((allFields, currentField) => {
		const field = {
			[currentField.name]: { type: singleToNetworkAggregationMap.get(currentField.type) },
		};
		return { ...allFields, ...field };
	}, {});
};

/**
 * Returns available aggregations by filtering duplicates, and mapping from
 * singular remote aggregation type to network aggregation types
 *
 * eg. NumericAggregations to NetworkNumericAggregations
 *
 * There is no distinction on which types come from which remote connections
 * This is the resolvers responsibility
 *
 * @param configs
 * @returns
 */
export const createNetworkAggregationTypeDefs = (
	networkFieldTypes: SupportedNetworkFieldType[],
) => {
	const allFields = convertToGQLObjectType(networkFieldTypes);

	const aggregationsType = new GraphQLObjectType({
		name: 'Aggregations',
		fields: allFields,
	});

	const aggregationList = new GraphQLObjectType({
		name: 'aggregations',
		fields: {
			name: { type: GraphQLString },
			type: { type: GraphQLString },
		},
	});

	const remoteConnectionType = new GraphQLObjectType({
		name: 'RemoteConnection',
		fields: {
			name: { type: GraphQLString },
			hits: { type: GraphQLInt },
			status: { type: GraphQLString },
			errors: { type: GraphQLString },
			aggregations: { type: new GraphQLList(aggregationList) },
		},
	});

	const remoteConnectionsType = new GraphQLList(remoteConnectionType);

	const networkType = new GraphQLObjectType({
		name: 'Network',
		fields: {
			remoteConnections: { type: remoteConnectionsType },
			aggregations: {
				type: aggregationsType,
				args: {
					filters: { type: GraphQLJSON },
					aggregations_filter_themselves: { type: GraphQLBoolean },
				},
			},
		},
	});

	// correct object structure to merge with other types
	const rootType = new GraphQLObjectType({
		name: 'Query',
		fields: {
			network: { type: networkType },
		},
	});

	const schemaTypes = new GraphQLSchema({
		query: rootType,
	});

	return schemaTypes;
};
