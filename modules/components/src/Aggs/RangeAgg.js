import React, { Component } from 'react';
import InputRange from 'react-input-range';
import convert from 'convert-units';
import _ from 'lodash';

import { replaceSQON } from '../SQONView/utils';
import AggsWrapper from './AggsWrapper';

import 'react-input-range/lib/css/index.css';
import './AggregationCard.css';
import './RangeAgg.css';

const SUPPORTED_CONVERSIONS = {
  time: ['d', 'year'],
};

const round = x => Math.round(x * 100) / 100;

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
        min: !_.isNil(value) ? value.min || min : min,
        max: !_.isNil(value) ? value.max || max : max,
      },
    };
  }

  componentWillReceiveProps(nextProps) {
    let { field, stats: { min, max } } = this.props;
    const { value: externalVal } = nextProps;
    let { value } = this.state;
    this.setState({
      field,
      min,
      max,
      value: {
        min: Math.max(
          !_.isNil(externalVal?.min) ? externalVal.min : value.min,
          min,
        ),
        max: Math.min(
          !_.isNil(externalVal?.max) ? externalVal.max : value.max,
          max,
        ),
      },
    });
  }

  onChangeComplete = () => {
    let { handleChange } = this.props;
    let { field, value } = this.state;
    const [min, max] = [value.min, value.max].map(x => round(x));
    handleChange?.({
      field,
      min,
      max,
      generateNextSQON: sqon =>
        replaceSQON(
          {
            op: 'and',
            content: [
              { op: '>=', content: { field, value: min } },
              { op: '<=', content: { field, value: max } },
            ],
          },
          sqon,
        ),
    });
  };

  setValue = ({ min, max }) => {
    if (
      round(min) >= round(this.state.min) &&
      round(max) <= round(this.state.max)
    ) {
      this.setState({ value: { min: round(min), max: round(max) } });
    }
  };

  formatRangeLabel = (value, type) => {
    const { formatLabel } = this.props;
    if (formatLabel) return formatLabel(value, type);
    const { unit, displayUnit } = this.state;
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
      step,
      field = '',
      Content = 'div',
      displayName = 'Unnamed Field',
      buckets = [],
      collapsible = true,
      handleChange = () => {},
    } = this.props;
    let { min, max, value, unit, displayUnit } = this.state;
    return (
      <AggsWrapper {...{ displayName }}>
        {[!_.isNil(min), !_.isNil(max)].every(Boolean) && (
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
                draggableTrack
                step={step}
                minValue={min}
                maxValue={max}
                value={value}
                formatLabel={this.formatRangeLabel}
                onChange={x => this.setValue(x)}
                onChangeComplete={this.onChangeComplete}
              />
            </div>
          </div>
        )}
      </AggsWrapper>
    );
  }
}

export default RangeAgg;
