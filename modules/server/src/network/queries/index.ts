/**
 * Part of the federated search is requesting aggregate data from
 * individual remote connections which expose an Arranger GQL endpoint
 *
 * These are the GQL queries for the supported GQL types
 */

import { SupportedNetworkAggregation, SUPPORTED_NETWORK_AGGREGATIONS } from '../common';

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

export const remoteConnectionQuery = new Map<SupportedNetworkAggregation, string>();
remoteConnectionQuery.set(SUPPORTED_NETWORK_AGGREGATIONS.NetworkAggregation, aggregationsQuery);
remoteConnectionQuery.set(SUPPORTED_NETWORK_AGGREGATIONS.NetworkNumericAggregations, '');
