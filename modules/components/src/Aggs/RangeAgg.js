import React, { Component } from 'react';
import InputRange from 'react-input-range';

import { minBy, maxBy } from 'lodash';

import 'react-input-range/lib/css/index.css';

const minMaxFromBuckets = ({ buckets }) => {
  return {
    min: +minBy(buckets, 'key').key,
    max: +maxBy(buckets, 'key').key,
  };
};

class RangeAgg extends Component {
  state = {
    min: 0,
    max: 1,
    value: { min: 0, max: 1 },
  };

  setMinMaxValueFromProps = props => {
    let { min, max } = minMaxFromBuckets(props);
    this.setState({ min, max, value: { min, max } });
  };

  componentWillMount() {
    this.setMinMaxValueFromProps(this.props);
  }

  componentWillReceiveProps(nextProps) {
    this.setMinMaxValueFromProps(nextProps);
  }

  setValue = x => {
    let { min, max } = this.state;
    this.setState({
      value: {
        min: x.min < min ? min : x.min,
        max: x.max > max ? max : x.max,
      },
    });
  };

  render() {
    let {
      field = '',
      Content = 'div',
      displayName = 'Unnamed Field',
      buckets = [],
    } = this.props;

    let { min, max, value } = this.state;

    return (
      <div className="test-range-aggregation">
        <div>
          <span>{displayName}</span>
        </div>
        <div style={{ marginTop: 50, marginBottom: 50 }}>
          <InputRange
            minValue={min}
            maxValue={max}
            value={value}
            onChange={x => this.setValue(x) }
          />
        </div>
        <div>
          {buckets
            .filter(b => +b.key >= value.min && +b.key <= value.max)
            .map(b => ({ ...b, name: b.key_as_string || b.key }))
            .map(x => <Content key={x.name}>{x.name} ({x.doc_count})</Content>)}
        </div>
      </div>
    );
  }
}

export default RangeAgg;
