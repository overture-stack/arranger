import React from 'react';
import TermAggregation from './TermAggregation';
import NumericAggregation from './NumericAggregation';

const aggregationTypeMap = {
  Aggregations: TermAggregation,
  NumericAggregations: NumericAggregation,
};

class FacetWrapper extends React.Component {
  state = {
    shouldScrollHere: false,
  };
  componentDidMount() {
    const { focusedFacet$, path } = this.props;
    this.focusSubscription$ = focusedFacet$
      ?.filter(({ field, value }) => field === path)
      ?.subscribe(() => {
        this.setState({ shouldScrollHere: true });
      });
  }
  componentWillUnmount() {
    this.focusSubscription$?.unsubscribe();
  }
  componentDidUpdate() {
    if (this.state.shouldScrollHere) {
      // can only scroll properly once the entire tree has been rendered.
      // proxying full tree render complete by enforcing a time delay after this component has finished rendering
      setTimeout(() => {
        this.container?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
        this.setState({ shouldScrollHere: false });
      }, 300);
    }
  }
  render() {
    const { aggType, searchboxSelection$, ...rest } = this.props;
    return (
      aggregationTypeMap[aggType] && (
        <div ref={el => (this.container = el)}>
          {aggregationTypeMap[aggType]({
            ...rest,
            aggType,
            searchboxSelection$,
          }) || null}
        </div>
      )
    );
  }
}

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
