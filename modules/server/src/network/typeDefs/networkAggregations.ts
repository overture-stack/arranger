import { GraphQLObjectType, GraphQLString } from 'graphql';
import { SUPPORTED_AGGREGATIONS, SUPPORTED_AGGREGATIONS_TYPE } from '../common';

// TODO: Placeholder to expand type
const networkAggregations = new GraphQLObjectType({
	name: 'NetworkAggregations',
	fields: {
		test: {
			type: GraphQLString,
		},
	},
});

// TODO: Placeholder to expand type
const numericNetworkAggregations = new GraphQLObjectType({
	name: 'NumericNetworkAggregations',
	fields: {
		test: {
			type: GraphQLString,
		},
	},
});

/**
 * return network aggregation gql type
 */
export const singleToNetworkAggregationMap = new Map<
	SUPPORTED_AGGREGATIONS_TYPE,
	GraphQLObjectType
>();
singleToNetworkAggregationMap.set(SUPPORTED_AGGREGATIONS.Aggregations, networkAggregations);
singleToNetworkAggregationMap.set(
	SUPPORTED_AGGREGATIONS.NumericAggregations,
	numericNetworkAggregations,
);
