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
  scrollToThis = () => {
    setTimeout(() => {
      this.container?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      this.setState({ shouldScrollHere: false });
    });
  };
  componentDidMount() {
    const { focusedFacet$, path } = this.props;
    focusedFacet$
      ?.filter(({ field, value }) => field === path)
      .subscribe(({ field }) => {
        this.setState({ shouldScrollHere: true });
      });
  }
  componentDidUpdate() {
    const { focusedFacet$, path } = this.props;
    focusedFacet$
      ?.filter(({ field, value }) => field === path)
      .subscribe(({ field }) => {
        this.setState({ shouldScrollHere: true });
      });
  }
  componentWillReceiveProps() {
    if (this.state.shouldScrollHere) {
      this.scrollToThis();
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
