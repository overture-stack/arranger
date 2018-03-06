import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

class FacetWrapper extends React.Component {
  render() {
    const { aggType, searchboxSelectionObservable, ...rest } = this.props;
    searchboxSelectionObservable.subscribe(field => {
      console.log(field);
    });
    return (
      aggregationTypeMap[aggType]?.({
        ...rest,
        aggType,
        ref: el => (this.refs.aggComponent = el),
      }) || null
    );
  }
}

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
      searchboxSelectionObservable,
    } = this.props;
    return (
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
  }
}
