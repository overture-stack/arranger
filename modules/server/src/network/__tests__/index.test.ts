import { buildSchema } from 'graphql';
import { createNetworkAggregationTypeDefs } from '../schema';
import { networkSchemas } from './fixtures';
import { isFieldDefined, isTypeDefined } from './utils';

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

	/**
	 * example: multiple remote connections have the same object definition
	 */
	test('it should de-deupe ObjectTypeDefinition', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		const numberOfResults = typeDefs.filter(
			(definition) =>
				definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Donor',
		).length;
		expect(numberOfResults).toEqual(1);
	});

	/**
	 * example: multiple remote connections have the same field
	 */
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

	/**
	 * example: a remote connection has a typeA but others don't
	 */
	test('it should "union" (set operation) typedefs', () => {
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		expect(isTypeDefined(typeDefs, 'Analysis')).toBe(true);
	});
});
