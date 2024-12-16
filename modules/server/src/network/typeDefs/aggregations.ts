import {
	GraphQLBoolean,
	GraphQLInt,
	GraphQLList,
	GraphQLObjectType,
	GraphQLSchema,
	GraphQLString,
} from 'graphql';
import GraphQLJSON from 'graphql-type-json';
import { SupportedNetworkFieldType } from '../setup/fields';

/**
 * Creates nested GQL structured object from field type
 * { name: 'donor_gender', type: 'Aggregation'}
 * =>
 * { name: 'donor_gender', type: { name: 'Aggregation' }}
 *
 * @param fieldTypes - An array of fields with types
 * @returns Structured GQL fields object
 */
const convertToGQLObjectType = (fieldTypes: SupportedNetworkFieldType[]) => {
	return fieldTypes.reduce((allFields, currentField) => {
		const field = {
			[currentField.name]: { type: currentField.type },
		};
		return { ...allFields, ...field };
	}, {});
};

/**
 * Typedefs for network search.
 * Typenames need to be unique globally or gql will merge / throw errors.
 *
 * TODO: Use a single convention of creating typedefs consistently
 * Some redundancy here by creating typedefs in object centric way.
 * There are typesdefs already declared as gql tagged template strings elsewhere.
 * Objects are easier to compose and are typesafe.
 */
export const createNetworkAggregationTypeDefs = (fieldTypes: SupportedNetworkFieldType[]) => {
	const fields = convertToGQLObjectType(fieldTypes);

	const aggregations = new GraphQLObjectType({
		name: 'NetworkAggregations',
		fields,
	});

	const node = new GraphQLObjectType({
		name: 'Node',
		fields: {
			name: { type: GraphQLString },
			hits: { type: GraphQLInt },
			status: { type: GraphQLString },
			errors: { type: GraphQLString },
		},
	});

	const networkType = new GraphQLObjectType({
		name: 'Network',
		fields: {
			nodes: { type: new GraphQLList(node) },
			aggregations: {
				type: aggregations,
			},
		},
	});

	const rootType = new GraphQLObjectType({
		name: 'Root',
		fields: {
			network: {
				type: networkType,
				args: {
					filters: { type: GraphQLJSON },
					aggregations_filter_themselves: { type: GraphQLBoolean },
					include_missing: { type: GraphQLBoolean },
				},
			},
		},
	});

	const schemaTypes = new GraphQLSchema({
		query: rootType,
	});

	return schemaTypes;
};
