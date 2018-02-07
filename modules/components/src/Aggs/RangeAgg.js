import React, { Component } from 'react';
import InputRange from 'react-input-range';
import convert from 'convert-units';

import 'react-input-range/lib/css/index.css';
import './AggregationCard.css';
import './RangeAgg.css';

import State from '../State';

const SUPPORTED_CONVERSIONS = {
  time: ['d', 'year'],
};

class RangeAgg extends Component {
  constructor(props) {
    super(props);
    let { field, stats: { min, max }, unit, value } = props;
    this.state = {
      field,
      min,
      max,
      unit: unit,
      displayUnit: unit,
      value: {
        min: value ? value.min || min : min,
        max: value ? value.max || max : max,
      },
    };
  }

  componentWillReceiveProps(nextProps) {
    let { field, stats: { min, max } } = this.props;
    let { value } = this.state;
    this.setState({
      field,
      min,
      max,
      value: { min: Math.max(value.min, min), max: Math.min(value.max, max) },
    });
  }

  onChangeComplete = callback => {
    let { field, value: { min, max } } = this.state;
    callback({ field, min, max });
  };

  setValue = ({ min, max }) => {
    this.setState({
      value: {
        min: Math.max(min, this.state.min),
        max: Math.min(max, this.state.max),
      },
    });
  };

  formatRangeLabel = (value, type) => {
    let { unit, displayUnit } = this.state;
    return unit && displayUnit
      ? Math.round(
          convert(value)
            .from(unit)
            .to(displayUnit) * 100,
        ) / 100
      : value;
  };

  render() {
    let {
      field = '',
      Content = 'div',
      displayName = 'Unnamed Field',
      buckets = [],
      handleChange = () => {},
    } = this.props;
    let { min, max, value, unit, displayUnit } = this.state;
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
                <div className="range-wrapper">
                  <div className="unit-wrapper">
                    {unit &&
                      SUPPORTED_CONVERSIONS[convert().describe(unit).measure]
                        .map(x => convert().describe(x))
                        .map(x => ({ ...x, active: x.abbr === displayUnit }))
                        .map(({ abbr, plural, active }) => (
                          <span key={abbr}>
                            <input
                              type="radio"
                              id={abbr}
                              value={abbr}
                              checked={active}
                              onChange={e =>
                                this.setState({ displayUnit: e.target.value })
                              }
                            />
                            <label htmlFor={abbr}>{plural}</label>
                          </span>
                        ))}
                  </div>
                  <div className="input-range-wrapper">
                    <InputRange
                      minValue={min}
                      maxValue={max}
                      value={value}
                      formatLabel={this.formatRangeLabel}
                      onChange={x => this.setValue(x)}
                      onChangeComplete={() =>
                        this.onChangeComplete(handleChange)
                      }
                    />
                  </div>
                </div>
              )}
          </div>
        )}
      />
    );
  }
}

export default RangeAgg;
