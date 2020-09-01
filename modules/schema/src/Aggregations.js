export let typeDefs = `
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
  }

  type NumericAggregations {
    stats: Stats
    histogram(interval: Float): Aggregations
  }

  type Aggregations {
    bucket_count: Int
    buckets: [Bucket]
  }
`;
