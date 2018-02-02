import React, { Component } from 'react';
import InputRange from 'react-input-range';

import 'react-input-range/lib/css/index.css';
import './AggregationCard.css';
import './RangeAgg.css';

import State from '../State';

class RangeAgg extends Component {
  state = {
    field: null,
    min: null,
    max: null,
    value: { min: null, max: null },
  };

  componentWillMount() {
    let { field, stats: { min, max } } = this.props;
    console.log('mount', field, min, max);
    this.setState({ field, min, max, value: { min, max } });
  }

  componentWillReceiveProps(nextProps) {
    let { field, stats: { min, max } } = this.props;
    let { value } = this.state
    console.log('receiveProps 1 ', field, min, max, value)
    let update = {
      field,
      min,
      max,
      value: { min: Math.max(value.min, min), max: Math.min(value.max, max) },
    };
    console.log('receiveProps', update);
    this.setState(update);
  }

  setValue = ({ min, max }) => {
    this.setState({
      value: {
        min: Math.max(min, this.state.min),
        max: Math.min(max, this.state.max),
      },
    });
  };

  onChangeComplete = callback => {
    let { field, value: { min, max } } = this.state;
    callback({ field, min, max });
  };

  render() {
    let {
      field = '',
      Content = 'div',
      displayName = 'Unnamed Field',
      buckets = [],
      handleChange = () => {},
    } = this.props;
    let { min, max, value } = this.state;
    return (
      <State
        initial={{ isCollapsed: false }}
        render={({ update, isCollapsed }) => (
          <div className="aggregation-card">
            <div
              className={`title-wrapper ${isCollapsed && 'collapsed'}`}
              onClick={() => update({ isCollapsed: !isCollapsed })}
            >
              <span className="title">{displayName}</span>
              <span className={`arrow ${isCollapsed && 'collapsed'}`} />
            </div>
            {!isCollapsed &&
              min !== null &&
              max !== null && (
                <div className="input-range-wrapper">
                  <InputRange
                    minValue={min}
                    maxValue={max}
                    value={value}
                    onChange={x => this.setValue(x)}
                    onChangeComplete={() => this.onChangeComplete(handleChange)}
                  />
                </div>
              )}
          </div>
        )}
      />
    );
  }
}

export default RangeAgg;
