/**
 * Part of the federated search is requesting aggregate data from
 * individual remote connections which expose an Arranger GQL endpoint
 *
 * These are the GQL queries for the supported GQL types
 */

import { Aggregations } from '../types/aggregations';

export type GQLFieldType = {
	name: string;
	type: {
		name: string;
	};
};

export type GQLTypeQueryResponse = {
	__type: {
		name: string;
		fields: GQLFieldType[];
	};
};

// Data query response
export type AggregationGQLResponse = {
	[documentName: string]: {
		[fieldName: string]: Aggregations;
	};
};

/**
 * Query to get field types
 * eg. __type('aggregations')
 */
export const gqlAggregationTypeQuery = `#graphql
	query getAggregationTypes($documentTypeName: String!) {
		__type(name: $documentTypeName) {
			name
			fields {
				name
				type {
					name
				}
			}
		}
	}
`;
