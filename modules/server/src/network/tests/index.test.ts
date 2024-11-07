// @ts-nocheck
// graphql types have readonly modifiers all the way down

/*
 * PLEASE NOTE:
 * Old tests not used anymore
 * Leaving in code base for now because the tests themselves are worthwhile to write, not currently in scope
 * Disabled using the "xdescribe" method
 */

import { mergeTypeDefs, mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema, mergeSchemas } from '@graphql-tools/schema';
import { buildSchema, printType } from 'graphql';
import { createNetworkAggregationTypeDefs } from '../typeDefs/aggregations';
import {
	typeDefsA,
	typeDefsB,
	typeDefsC,
	typeDefsD,
	typeDefsE,
	typeDefsF,
	typeDefsG,
} from './fixtures';
import { isFieldDefined, isTypeDefined } from './utils';

xdescribe('network aggregation', () => {
	test('it should have defined GQL Object types', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];
		console.log('ns', networkSchemas);
		const s = mergeTypeDefs([buildSchema(typeDefsA), buildSchema(typeDefsB)]);
		console.log('typedefs', s);
		const typeDefs = createNetworkAggregationTypeDefs(networkSchemas);
		//const x = mergeTypeDefs([typeDefs, typeDefs]);
		//	const typeDefs = actualOutput.definitions;
		console.log(typeDefs._typeMap);

		expect(isTypeDefined(typeDefs, 'Aggs')).toEqual(true);
		expect(isTypeDefined(typeDefs, 'Donor')).toEqual(true);
	});

	test('it should have defined fields for types', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];

		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;

		expect(isFieldDefined(typeDefs, 'Aggs', 'donors')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Donor', 'gender')).toEqual(true);
	});

	/**
	 * Example: multiple remote connections have the same object definition
	 */
	test('it should de-dupe ObjectTypeDefinition', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];

		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		const numberOfResults = typeDefs.filter(
			(definition) =>
				definition.kind === 'ObjectTypeDefinition' && definition.name.value === 'Donor',
		).length;
		expect(numberOfResults).toEqual(1);
	});

	/**
	 * Example: multiple remote connections have the same field
	 */
	test('it should de-dupe FieldDefinition', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];

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
	 * Example: a remote connection has a typeA but others don't
	 */
	test('it should "union" (set operation) typedefs', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB)];

		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		expect(isTypeDefined(typeDefs, 'Analysis')).toBe(true);
	});

	/**
	 * Merging more than two schemas
	 */
	test('it should merge multiple schemas', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB), buildSchema(typeDefsC)];

		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;
		// shared type
		expect(isTypeDefined(typeDefs, 'Analysis')).toBe(true);
		// at least one field from each type is defined
		// A
		expect(isFieldDefined(typeDefs, 'Donor', 'age')).toEqual(true);
		// B
		expect(isFieldDefined(typeDefs, 'Aggs', 'location')).toEqual(true);
		// C
		expect(isFieldDefined(typeDefs, 'Analysis', 'date')).toEqual(true);
	});

	/**
	 * Schemas with no overlapping types
	 */
	test('it should merge schemas with no overlapping fields/types', () => {
		const networkSchemas = [buildSchema(typeDefsD), buildSchema(typeDefsE)];
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;

		expect(isTypeDefined(typeDefs, 'Donor')).toEqual(true);
		expect(isTypeDefined(typeDefs, 'Lab')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Donor', 'gender')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Lab', 'location')).toEqual(true);
	});

	/**
	 * All types and fields should be present in output schema
	 */
	test('it should merge with all types/fields from each schema found in output schema', () => {
		const networkSchemas = [buildSchema(typeDefsA), buildSchema(typeDefsB), buildSchema(typeDefsC)];
		const actualOutput = createNetworkAggregationTypeDefs(networkSchemas);
		const typeDefs = actualOutput.definitions;

		expect(isTypeDefined(typeDefs, 'Aggs')).toEqual(true);
		expect(isTypeDefined(typeDefs, 'Donor')).toEqual(true);
		expect(isTypeDefined(typeDefs, 'Analysis')).toEqual(true);

		expect(isFieldDefined(typeDefs, 'Aggs', 'donors')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Aggs', 'analysis')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Aggs', 'location')).toEqual(true);

		expect(isFieldDefined(typeDefs, 'Donor', 'gender')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Donor', 'age')).toEqual(true);

		expect(isFieldDefined(typeDefs, 'Analysis', 'type')).toEqual(true);
		expect(isFieldDefined(typeDefs, 'Analysis', 'date')).toEqual(true);
	});

	/***
	 * Handle type collisions
	 */
	test('it should handle type collisions', () => {
		const networkSchemas = [buildSchema(typeDefsF), buildSchema(typeDefsG)];
		expect(() => createNetworkAggregationTypeDefs(networkSchemas)).toThrow();
	});
});
