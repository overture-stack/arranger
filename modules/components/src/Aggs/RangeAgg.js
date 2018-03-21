import React, { Component } from 'react';
import InputRange from 'react-input-range';
import convert from 'convert-units';
import _ from 'lodash';

import { replaceSQON } from '../SQONView/utils';
import mapObjectValues from '../utils/mapObjectValues';
import AggsWrapper from './AggsWrapper';

import 'react-input-range/lib/css/index.css';
import './AggregationCard.css';
import './RangeAgg.css';

const SUPPORTED_CONVERSIONS = {
  time: ['d', 'year'],
};

const isNil = _.isNil;

class RangeAgg extends Component {
  constructor(props) {
    super(props);
    let { field, stats: { min, max }, unit, value } = props;
    this.state = {
      field,
      unit: unit,
      displayUnit: unit,
      ...this.normalizeValue({ min, max, value }),
    };
  }

  normalizeValue = ({ min, max, value }) => {
    const { normalize = x => x } = this.props;
    if (isNil(min) && !isNil(this.state?.min)) min = this.state.min;
    if (isNil(max) && !isNil(this.state?.max)) max = this.state.max;
    const finalNormalize = x => (!isNil(x) ? normalize(x) : x);
    return mapObjectValues(
      {
        min,
        max,
        value: {
          min: Math.max(!isNil(value?.min) ? value.min : min, min),
          max: Math.min(!isNil(value?.max) ? value.max : max, max),
        },
      },
      finalNormalize,
    );
  };

  componentWillReceiveProps(nextProps) {
    let { field, stats: { min, max } } = this.props;
    const { value: externalVal } = nextProps;
    let { value } = this.state;
    this.setState({
      field,
      ...this.normalizeValue({
        min,
        max,
        value: {
          min: !isNil(externalVal?.min) ? externalVal.min : value?.min,
          max: !isNil(externalVal?.max) ? externalVal.max : value?.max,
        },
      }),
    });
  }

  onChangeComplete = () => {
    let { denormalize = x => x, handleChange } = this.props;
    let { field, value } = this.state;
    const [min, max] = [value.min, value.max].map(x => denormalize(x));
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

  onChange = ({ min, max }) => {
    if (min >= this.state.min && max <= this.state.max) {
      this.setState({ value: { min, max } });
    }
  };

  render() {
    let {
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
        {[!isNil(min), !isNil(max)].every(Boolean) && (
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
                minValue={min}
                maxValue={max}
                value={value}
                formatLabel={this.formatRangeLabel}
                onChange={this.onChange}
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
