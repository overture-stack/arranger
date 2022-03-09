import React, { Component } from 'react';
import InputRange from 'react-input-range';
import convert from 'convert-units';
import { isNil } from 'lodash';
import { css } from '@emotion/react';

import { replaceFieldSQON } from '../SQONView/utils';
import AggsWrapper from './AggsWrapper';
import formatNumber from '../utils/formatNumber';

import 'react-input-range/lib/css/index.css';
import './AggregationCard.css';
import './RangeAgg.css';

const SUPPORTED_CONVERSIONS = {
  time: ['d', 'year'],
  digital: ['GB'],
};

const supportedConversionFromUnit = (unit) =>
  unit ? SUPPORTED_CONVERSIONS[convert().describe(unit).measure] : [];

const round = (x) => Math.round(x * 100) / 100;

const RangeLabel = ({ children, isTop, position, ...props }) => (
  <div
    {...props}
    css={css`
      position: absolute;
      ${position === 'right' && `${position}: 0;`}
      top: ${isTop ? `-` : ``}1.2rem;
    `}
  >
    {children}
  </div>
);

const getLabelId = (displayName) => {
  return `${displayName.split('(')[0].trim().toLowerCase().replace(/\s/g, '-')}__range-label`;
};

class RangeAgg extends Component {
  constructor(props) {
    super(props);
    const {
      sqonValues,
      stats: { max = 0, min = 0 },
      unit,
    } = props;

    const supportedConversions = supportedConversionFromUnit(unit);

    this.state = {
      currentValues: {
        max: sqonValues?.max || max,
        min: sqonValues?.min || min,
      },
      displayUnit: supportedConversions?.includes(unit)
        ? unit // use unit selected in Admin UI as default, if available here
        : supportedConversions?.[0],
      supportedConversions,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    const {
      sqonValues: { max: sqonMax, min: sqonMin } = {},
      stats: { max: newMax, min: newMin } = {},
    } = nextProps;
    const { stats: { max: oldMax, min: oldMin } = {} } = this.props;
    const { currentValues: { max: selectedMax, min: selectedMin } = {} } = this.state;

    const resetMax = isNil(sqonMax)
      ? isNil(oldMax) || (newMax > oldMax && oldMax === selectedMax)
      : newMax < selectedMax || newMin > selectedMax;
    const resetMin = isNil(sqonMin)
      ? isNil(oldMin) || (newMin < oldMin && oldMin === selectedMin)
      : newMin > selectedMin || newMax < selectedMin;

    this.setState({
      currentValues: {
        max: resetMax ? newMax : Math.min(sqonMax || selectedMax, newMax),
        min: resetMin ? newMin : Math.max(sqonMin || selectedMin, newMin),
      },
    });
  }

  onChangeComplete = () => {
    let {
      displayName,
      field,
      handleChange,
      stats: { max, min },
    } = this.props;
    let { currentValues, displayUnit } = this.state;
    const [currentMax, currentMin] = [currentValues.max, currentValues.min].map((x) => round(x));

    return handleChange?.({
      field: {
        displayName,
        displayUnit,
        field,
      },
      generateNextSQON: (sqon) =>
        replaceFieldSQON(
          field,
          {
            op: 'and',
            content: [
              ...(currentMin > min ? [{ op: '>=', content: { field, value: currentMin } }] : []),
              ...(currentMax < max ? [{ op: '<=', content: { field, value: currentMax } }] : []),
            ],
          },
          sqon,
        ),
      max: currentMax,
      min: currentMin,
      value: currentValues,
    });
  };

  setNewUnit = (event) => this.setState({ displayUnit: event.target.value });

  setNewValue = ({ max: newMax, min: newMin }) => {
    const {
      stats: { max, min },
    } = this.props;

    if (round(newMax) <= round(max) && round(newMin) >= round(min)) {
      this.setState({ currentValues: { max: round(newMax), min: round(newMin) } });
    }
  };

  formatRangeLabel = (value, type) => {
    const { formatLabel, unit } = this.props;
    const { displayUnit } = this.state;

    return (
      formatLabel?.(value, type) ||
      formatNumber(
        unit && displayUnit
          ? Math.round(convert(value).from(unit).to(displayUnit) * 100) / 100
          : value,
      )
    );
  };

  render() {
    const {
      collapsible = true,
      displayName = 'Unnamed Field',
      field,
      rangeStep,
      stats: { max, min },
      step,
      type,
      WrapperComponent,
    } = this.props;
    const { currentValues, displayUnit, supportedConversions } = this.state;

    const hasData = [!isNil(min), !isNil(max)].every(Boolean);

    const dataFields = {
      'data-available': hasData,
      ...(field && { 'data-field': field }),
      ...(type && { 'data-type': type }),
    };

    const minIsMax = min === max;
    const unusable = min + rangeStep === max || minIsMax;

    return (
      <AggsWrapper
        dataFields={dataFields}
        displayName={`${displayName}${
          displayUnit ? ` (${convert().describe(displayUnit).plural})` : ``
        }`}
        {...{ WrapperComponent, collapsible }}
      >
        {hasData ? (
          <div className="range-wrapper">
            {supportedConversions.length > 1 && (
              <div className="unit-wrapper">
                {supportedConversions
                  .map((x) => convert().describe(x))
                  .map((x) => ({ ...x, active: x.abbr === displayUnit }))
                  .map(({ abbr, plural, active }) => (
                    <label htmlFor={abbr} key={abbr}>
                      <input
                        checked={active}
                        id={abbr}
                        onChange={this.setNewUnit}
                        type="radio"
                        value={abbr}
                      />
                      {plural}
                    </label>
                  ))}
              </div>
            )}

            <div className={`input-range-wrapper${unusable ? ' disabled' : ''}`}>
              <RangeLabel isTop>{this.formatRangeLabel(currentValues.min)}</RangeLabel>
              {!minIsMax && (
                <RangeLabel isTop position="right">
                  {this.formatRangeLabel(currentValues.max)}
                </RangeLabel>
              )}

              <InputRange
                ariaLabelledby={getLabelId(displayName)}
                className={unusable ? 'disabled' : ''}
                draggableTrack
                disabled={unusable}
                step={step}
                minValue={min}
                maxValue={max}
                value={currentValues}
                formatLabel={this.formatRangeLabel}
                onChange={this.setNewValue}
                onChangeComplete={this.onChangeComplete}
              />

              <RangeLabel>{this.formatRangeLabel(currentValues.min)}</RangeLabel>
              {!minIsMax && <RangeLabel position="right">{this.formatRangeLabel(max)}</RangeLabel>}
              <span
                id={getLabelId(displayName)}
                css={css`
                  position: absolute;
                  height: 0;
                  width: 0;
                  top: -9999px;
                  left: -9999px;
                `}
              >
                Set {displayName}
              </span>
            </div>
          </div>
        ) : (
          <span className="no-data">No data available</span>
        )}
      </AggsWrapper>
    );
  }
}

export default RangeAgg;
