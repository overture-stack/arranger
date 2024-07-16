import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { NetworkAggregationConfig } from '../types';
import { singleToNetworkAggMap } from './networkAggregations';

type AvailableAggregation = { name: string; type: string };
const filterAvailableAggregations = (agg: unknown): agg is AvailableAggregation => {
	return agg && agg.name !== undefined && agg.type !== undefined;
};

/**
 * TODO: Filter out unsupported aggs
 */
const filterSupportedAggregations = () => {};

/**
 * Returns available aggregations by filtering duplicates, and mapping from
 * singular remote aggregation type to network aggregation types
 *
 * eg. NumericAggregation to NetworkNumericAggregation
 *
 * There is no distinction on which types come from which remote connections
 * This is the resolvers responsibility
 *
 * @param configs
 * @returns
 */
export const createNetworkAggregationTypeDefs = (configs: NetworkAggregationConfig[]) => {
	/**
	 * converts to GQLObjectType field shape
	 * { name: "foo", type: "String" } => { foo: { type: "String" } }
	 */
	const fields = configs
		.flatMap((config) => config.availableAggregations)
		.filter((agg) => filterAvailableAggregations(agg))
		.reduce((fields, currentAgg) => {
			const field = { [currentAgg.name]: { type: singleToNetworkAggMap['Aggregations'] } };
			return { ...fields, ...field };
		}, {});

	const typeDefs = new GraphQLObjectType({
		name: 'aggregations',
		fields,
	});

	// correct object structure to merge with other types
	const rootType = new GraphQLObjectType({
		name: 'Query',
		fields: {
			aggregations: {
				type: typeDefs,
			},
		},
	});

	const schemaTypes = new GraphQLSchema({
		query: rootType,
	});

	return schemaTypes;
};
