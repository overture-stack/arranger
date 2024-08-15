import { GraphQLInt, GraphQLObjectType, GraphQLString } from 'graphql';
import { SupportedAggregation, SUPPORTED_AGGREGATIONS } from '../common';

// TODO: Placeholder to expand type
const networkAggregations = new GraphQLObjectType({
	name: 'NetworkAggregations',
	fields: {
		bucket_count: {
			type: GraphQLInt,
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
export const singleToNetworkAggregationMap = new Map<SupportedAggregation, GraphQLObjectType>();
singleToNetworkAggregationMap.set(SUPPORTED_AGGREGATIONS.Aggregations, networkAggregations);
singleToNetworkAggregationMap.set(
	SUPPORTED_AGGREGATIONS.NumericAggregations,
	numericNetworkAggregations,
);
