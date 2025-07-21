export const AggregationsQuery = (fieldName) => `
  ${fieldName}
  {
    bucket_count
    buckets {
      doc_count
      key
    }
  }
`;

export const NumericAggregationsQuery = (field) => ``;
