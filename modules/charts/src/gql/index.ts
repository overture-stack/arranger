export const queryTemplateAggregations = (fieldName) => {
	return `
  ${fieldName}
  {
    bucket_count
    buckets {
      doc_count
      key
    }
  }
`;
};

export const queryTemplateNumericAggregations = (field) => {
	return `
  ${fieldName}
  range() {
  {
    bucket_count
    buckets {
      doc_count
      key
    }
}}
`;
};
