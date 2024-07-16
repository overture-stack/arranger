import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { NetworkAggregationConfig, NetworkFieldType } from '../types';
import { singleToNetworkAggMap } from './networkAggregations';

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
export const createNetworkAggregationTypeDefs = (networkFieldTypes: NetworkFieldType[]) => {
	/**
	 * converts to GQLObjectType field shape
	 * { name: "foo", type: "String" } => { foo: { type: "String" } }
	 */
	const allFields = networkFieldTypes.reduce((allFields, currentField) => {
		const field = { [currentField.name]: { type: singleToNetworkAggMap['Aggregations'] } };
		return { ...allFields, ...field };
	}, {});

	const typeDefs = new GraphQLObjectType({
		name: 'Aggregations',
		fields: allFields,
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
