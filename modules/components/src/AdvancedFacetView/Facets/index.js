import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

const FacetWrapper = ({ aggType, searchboxSelectionObservable, ...rest }) =>
  aggregationTypeMap[aggType]?.({
    ...rest,
    aggType,
    searchboxSelectionObservable,
  }) || null;

export default ({
  aggType,
  aggProps,
  title,
  path,
  sqon = {},
  constructEntryId = ({ value }) => value,
  onValueChange,
  searchboxSelectionObservable,
}) => (
  <FacetWrapper
    {...{
      aggType,
      aggProps,
      title,
      sqon,
      path,
      constructEntryId,
      searchboxSelectionObservable,
    }}
    onValueChange={({ value }) => {
      onValueChange({ value: value });
    }}
  />
);
