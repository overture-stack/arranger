/**
 * Part of the federated search is requesting aggregate data from
 * individual remote connections which expose an Arranger GQL endpoint
 *
 * These are the GQL queries for the supported GQL types
 */

import { SupportedAggregation, SUPPORTED_AGGREGATIONS } from '../common';

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

/**
 * Query to get field types
 * eg. __type('aggregations')
 */
export const gqlAggregationTypeQuery = `#graphql
	query getAggregationTypes($documentName: String!) {
		__type(name: $documentName) {
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

// TODO: queries with variables eg. top_hits(_source:[String], size:Int): JSON
const aggregationsQuery = /* GraphQL */ `#graphql
      query AggregationsQuery() {
        bucket_count
        buckets {
          key
          doc_count
          key_as_string
        }
}`;

/**
 * Returns gql query for gql type
 */
export const remoteConnectionQuery = new Map<SupportedAggregation, string>();
remoteConnectionQuery.set(SUPPORTED_AGGREGATIONS.Aggregations, aggregationsQuery);
remoteConnectionQuery.set(SUPPORTED_AGGREGATIONS.NumericAggregations, '');
