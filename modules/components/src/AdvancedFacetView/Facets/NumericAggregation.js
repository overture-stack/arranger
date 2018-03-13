import React from 'react';
import RangeAgg from '../../Aggs/RangeAgg';
import Component from 'react-component-component';

import { currentFieldValue } from '../../SQONView/utils';

class NumericAggregation extends React.Component {
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
    const { aggType, aggProps, title, onValueChange, sqon, path } = this.props;
    return (
      aggProps?.stats && (
        <div ref={el => (this.container = el)}>
          <RangeAgg
            stats={aggProps?.stats}
            collapsible={false}
            value={{
              min:
                currentFieldValue({ sqon, dotField: path, op: '>=' }) ||
                aggProps?.stats?.min ||
                0,
              max:
                currentFieldValue({ sqon, dotField: path, op: '<=' }) ||
                aggProps?.stats?.max ||
                0,
            }}
            displayName={title}
            handleChange={({ min, max, field }) =>
              onValueChange({
                value: { min, max },
              })
            }
          />
        </div>
      )
    );
  }
}
export default props => <NumericAggregation {...props} />;
