import {
	GraphQLBoolean,
	GraphQLEnumType,
	GraphQLInt,
	GraphQLList,
	GraphQLObjectType,
	GraphQLSchema,
	GraphQLString,
} from 'graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

import { type SupportedNetworkFieldType } from '#network/setup/fields.js';

const bucket = new GraphQLObjectType({
	name: 'Bucket',
	fields: {
		doc_count: {
			type: GraphQLInt,
		},
		key: {
			type: GraphQLString,
		},
	},
});

// GraphQL object style version of GQL type already defined, need object for this setup
const aggregationsTypeDef = new GraphQLObjectType({
	name: 'Aggregations',
	fields: {
		bucket_count: {
			type: GraphQLInt,
		},
		buckets: {
			type: new GraphQLList(bucket),
		},
	},
});

const typeDefMap = {
	Aggregations: aggregationsTypeDef,
};

/**
 * Creates nested GQL structured object from field type
 * { name: 'donor_gender', type: 'Aggregation'}
 * =>
 * { 'donor_gender', type: 'Aggregation' }
 *
 * @param fieldTypes - An array of fields with types
 * @returns Structured GQL fields object
 */
const convertToGQLObjectType = (networkFieldTypes: SupportedNetworkFieldType[]) => {
	return networkFieldTypes.reduce((allFields, currentField) => {
		const field = {
			[currentField.name]: {
				type: typeDefMap[currentField.type],
			},
		};
		return { ...allFields, ...field };
	}, {});
};

/**
 * Returns aggregations typedef
 *
 * @param configs
 * @returns
 */
export const createNetworkAggregationTypeDefs = (networkFieldTypes: SupportedNetworkFieldType[]) => {
	const allFields = convertToGQLObjectType(networkFieldTypes);

	const aggregationsType = new GraphQLObjectType({
		name: 'NodeAggregations',
		fields: allFields,
	});

	const remoteConnectionType = new GraphQLObjectType({
		name: 'NetworkNode',
		fields: {
			name: { type: GraphQLString },
			hits: { type: GraphQLInt },
			status: { type: GraphQLString },
			errors: { type: GraphQLString },
		},
	});

	const connectionNodeType = new GraphQLList(remoteConnectionType);

	const networkType = new GraphQLObjectType({
		name: 'Network',
		fields: {
			nodes: { type: connectionNodeType },
			aggregations: {
				type: aggregationsType,
			},
		},
	});

	// correct object structure to merge with other types
	const rootType = new GraphQLObjectType({
		name: 'Root',
		fields: {
			network: {
				type: networkType,
				args: {
					filters: { type: GraphQLJSONObject },
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
