/**
 *
 * @param  enableDocumentHits if false, agg only mode is enabled, add to GQL schema definition
 * @returns typedef string
 */
export const typeDefs = ({ enableDocumentHits }: { enableDocumentHits: boolean }) => `
  type Stats {
    max: Float
    min: Float
    count: Int
    avg: Float
    sum: Float
  }

  type Bucket {
    doc_count: Int
    key: String
    key_as_string: String
    top_hits(_source:[String], size:Int): JSON
    filter_by_term(filter: JSON): JSON 
    ${!enableDocumentHits ? 'belowThreshold: Boolean' : ''}
  }

  type NumericAggregations {
    stats: Stats
    histogram(interval: Float): Aggregations
  }

  type Aggregations {
    bucket_count: Int
    buckets(max:Int): [Bucket]
    cardinality(precision_threshold:Int): Int
  }
`;
