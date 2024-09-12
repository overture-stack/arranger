import { GraphQLObjectType, GraphQLSchema } from 'graphql';
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
