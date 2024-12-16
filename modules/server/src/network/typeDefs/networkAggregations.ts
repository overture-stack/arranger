import { GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLString } from 'graphql';
import { SupportedAggregation, SUPPORTED_AGGREGATION } from '../setup/constants';

const bucket = new GraphQLObjectType({
	name: 'bucket',
	fields: {
		doc_count: {
			type: GraphQLInt,
		},
		key: {
			type: GraphQLString,
		},
		relation: {
			type: GraphQLString,
		},
	},
});

// TODO: Placeholder to expand type
const networkAggregations = new GraphQLObjectType({
	name: 'NetworkAggregations',
	fields: {
		bucket_count: {
			type: GraphQLInt,
		},
		buckets: {
			type: new GraphQLList(bucket),
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
singleToNetworkAggregationMap.set(SUPPORTED_AGGREGATION.Aggregations, networkAggregations);
singleToNetworkAggregationMap.set(
	SUPPORTED_AGGREGATION.NumericAggregations,
	numericNetworkAggregations,
);
