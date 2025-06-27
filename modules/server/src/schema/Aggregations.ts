export const typeDefs = `
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
  }

  input RangesArg {
    to: Int
    from: Int
    key: String
  }

  type NumericAggregations {
    stats: Stats
    histogram(interval: Float): Aggregations
    range(ranges: [RangesArg]): Aggregations
  }

  type Aggregations {
    bucket_count: Int
    buckets(max:Int): [Bucket]
    cardinality(precision_threshold:Int): Int
  }
`;
