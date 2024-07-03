// @ts-nocheck
// graphql types have readonly modifiers all the way down

import { buildSchema } from 'graphql';
import { createNetworkAggregationTypeDefs } from '../schema';

/**
 *
 * @param typeDefs - Array of DefinitionNodes representing the schema type definitions
 * @param typeName - ObjectTypeDefinition
 * @returns true if type is defined
 */
const isTypeDefined = (typeDefs, typeName) => {
	return typeDefs.some(
		(definition) =>
			definition.kind === 'ObjectTypeDefinition' && definition.name.value === typeName,
	);
};

/**
 *
 * @param typeDefs - Array of DefinitionNodes representing the schema type definitions
 * @param parent - ObjectTypeDefinition name
 * @param child - FieldDefinition name
 * @returns true if field is defined
 */
const isFieldDefined = (typeDefs, parent, child) => {
	const parentTypeDefFields = typeDefs.find(
		(definition) => definition.kind === 'ObjectTypeDefinition' && definition.name.value === parent,
	).fields;
	return parentTypeDefFields.some(
		(definitions) => (definitions.kind = 'FieldDefinition' && definitions.name.value === child),
	);
};

/**
 * At no point do we modify the type definitions within the tests
 */
const typeDefsA = /* GraphQL */ `
	type Query {
		aggs: Aggs
	}

	type Aggs {
		donors: Donor
	}

	type Donor {
		gender: String
	}
`;

const typeDefsB = /* GraphQL */ `
	type Query {
		aggs: Aggs
	}

	type Aggs {
		donors: Donor
		analysis: Analysis
	}

	type Donor {
		gender: String
	}

	type Analysis {
		type: String
	}
`;

const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];

describe('network aggregation', () => {
	test('it should have defined GQL Object types', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;

		expect(isTypeDefined(typeDefs, 'Aggs')).toEqual(true);
		expect(isTypeDefined(typeDefs, 'Donor')).toEqual(true);
	});

	test('it should have defined fields for types', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;

		expect(isFieldDefined(typeDefs, 'Aggs', 'donors')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Donor', 'gender')).toEqual(true);
	});

	test('it should de-deupe ObjectTypeDefinition', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		const numberOfResults = typeDefs.filter(
			(definition) =>
				definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Donor',
		).length;
		expect(numberOfResults).toEqual(1);
	});

	test('it should de-deupe FieldDefinition', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		const numberOfResults = typeDefs
			.find(
				(definition) =>
					definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Donor',
			)
			.fields.filter(
				(definitions) =>
					(definitions.kind = 'FieldDefinition' && definitions.name.value === 'gender'),
			).length;

		expect(numberOfResults).toEqual(1);
	});

	test('it should "union" (set operation) typedefs', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		expect(isTypeDefined(typeDefs, 'Analysis')).toBe(true);
	});
});
