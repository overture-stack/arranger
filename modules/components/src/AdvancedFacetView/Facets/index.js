import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

const FacetWrapper = ({ aggType, ...rest }) =>
  aggregationTypeMap[aggType]?.({ ...rest, aggType }) || null;

export default class extends React.Component {
  render() {
    const {
      aggType,
      aggProps,
      title,
      path,
      sqon = {},
      constructEntryId = ({ value }) => value,
      onValueChange,
    } = this.props;
    return (
      <FacetWrapper
        {...{ aggType, aggProps, title, sqon, path, constructEntryId }}
        onValueChange={({ value }) => {
          onValueChange({ value: value });
        }}
      />
    );
  }
}
