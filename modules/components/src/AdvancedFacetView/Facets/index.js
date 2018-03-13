import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

const FacetWrapper = ({ aggType, searchboxSelection$, ...rest }) =>
  aggregationTypeMap[aggType]?.({
    ...rest,
    aggType,
    searchboxSelection$,
  }) || null;

export default ({
  aggType,
  aggProps,
  title,
  path,
  sqon = {},
  constructEntryId = ({ value }) => value,
  onValueChange,
  searchboxSelection$,
  focusedFacet$,
  valueCharacterLimit,
}) => (
  <FacetWrapper
    {...{
      aggType,
      aggProps,
      title,
      sqon,
      path,
      constructEntryId,
      searchboxSelection$,
      valueCharacterLimit,
      focusedFacet$,
    }}
    onValueChange={({ value }) => {
      onValueChange({ value: value });
    }}
  />
);
