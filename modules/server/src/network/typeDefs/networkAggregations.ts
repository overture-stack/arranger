import { GraphQLObjectType, GraphQLString } from 'graphql';

const networkAggregations = new GraphQLObjectType({
	name: 'NetworkAggregations',
	fields: {
		test: {
			type: GraphQLString,
		},
	},
});

const numericNetworkAggregations = new GraphQLObjectType({
	name: 'NumericNetworkAggregations',
	fields: {
		test: {
			type: GraphQLString,
		},
	},
});

export const singleToNetworkAggMap = {
	Aggregations: networkAggregations,
	NumericAggregations: numericNetworkAggregations,
};
