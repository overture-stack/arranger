export const useChartsQuery = ({ documentType, fields }) => {
  const fullQuery = `
    query ChartsQuery($filters: JSON) {
      ${documentType} {
        aggregations(
          filters: $filters
          include_missing: true
          aggregations_filter_themselves: true
        ) {
          ${fields.map((fieldName) => AggregationsQuery(fieldName))}
        }
      }
    }`;

  return {
    resolve: () => {
      return fullQuery;
    },
  };
};

const AggregationsQuery = (fieldName) => `
  ${fieldName}
  {
    bucket_count
    buckets {
      doc_count
      key
    }
  }
`;

const NumericAggregationsQuery = (field) => ``;
