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
  digital: ['GB'],
};

const supportedConversionFromUnit = unit =>
  unit ? SUPPORTED_CONVERSIONS[convert().describe(unit).measure] : null;

const round = x => Math.round(x * 100) / 100;

class RangeAgg extends Component {
  constructor(props) {
    super(props);
    let { stats: { min, max }, unit, value } = props;
    this.state = {
      min,
      max,
      unit: unit,
      displayUnit: supportedConversionFromUnit(unit)?.[0],
      value: {
        min: !_.isNil(value) ? value.min || min : min,
        max: !_.isNil(value) ? value.max || max : max,
      },
    };
  }

  componentWillReceiveProps(nextProps) {
    const { stats: { min, max }, value: externalVal } = nextProps;
    let { value } = this.state;
    this.setState({
      min,
      max,
      value: {
        min: Math.max(externalVal?.min || value.min, min),
        max: Math.min(externalVal?.max || value.max, max),
      },
    });
  }

  onChangeComplete = () => {
    let { field, handleChange } = this.props;
    let { value } = this.state;
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
      displayName = 'Unnamed Field',
      collapsible = true,
      WrapperComponent,
    } = this.props;
    let { min, max, value, unit, displayUnit } = this.state;
    const supportedConversions = supportedConversionFromUnit(unit);
    return (
      <AggsWrapper
        displayName={`${displayName}${
          displayUnit ? ` (${convert().describe(displayUnit).plural})` : ``
        }`}
        {...{ WrapperComponent, collapsible }}
      >
        {[!_.isNil(min), !_.isNil(max)].every(Boolean) && (
          <div className="range-wrapper">
            <div className="unit-wrapper">
              {supportedConversions?.length > 1 &&
                supportedConversions
                  ?.map(x => convert().describe(x))
                  ?.map(x => ({ ...x, active: x.abbr === displayUnit }))
                  ?.map(({ abbr, plural, active }) => (
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
