import React, { Fragment } from 'react';
import Component from 'react-component-component';
import { sortBy, min, max } from 'lodash';
import PropTypes from 'prop-types';
import convert from 'convert-units';
import './FilterContainerStyle.css';
import {
  getOperationAtPath,
  setSqonAtPath,
  FIELD_OP_DISPLAY_NAME,
  RANGE_OPS,
  BETWEEN_OP,
  GTE_OP,
  GT_OP,
  LTE_OP,
  LT_OP,
} from '../utils';
import { FilterContainer } from './common';

const SUPPORTED_CONVERSIONS = {
  time: ['d', 'month', 'year'],
  digital: ['GB', 'B'],
};

const supportedConversionFromUnit = unit =>
  unit ? SUPPORTED_CONVERSIONS[convert().describe(unit).measure] : null;

const normalizeNumericFieldOp = fieldOp => ({
  ...fieldOp,
  content: {
    ...fieldOp.content,
    value: Array.isArray(fieldOp.content.value)
      ? [min(fieldOp.content.value), max(fieldOp.content.value)]
      : [fieldOp.content.value],
  },
});

export const RangeFilterUi = props => {
  const {
    field: fieldName = null,
    sqonPath = [],
    initialSqon = null,
    onSubmit = sqon => {},
    onCancel = () => {},
    fieldDisplayNameMap = {},
    opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
    ContainerComponent = FilterContainer,
    InputComponent = props => (
      <input
        {...props}
        className={`rangeFilterInput ${props.className || ''}`}
      />
    ),
    unit: originalUnit = null,
  } = props;

  const initialFieldOp = (() => {
    const fieldOp = getOperationAtPath(sqonPath)(initialSqon);
    return fieldOp
      ? normalizeNumericFieldOp(fieldOp)
      : {
          op: BETWEEN_OP,
          content: { value: [], field: fieldName || fieldOp.content.field },
        };
  })();
  const field = fieldName || initialFieldOp.content.field;
  const initialState = {
    selectedOperation: initialFieldOp.op,
    minValue: min(initialFieldOp.content.value),
    maxValue: max(initialFieldOp.content.value),
    selectedUnit: originalUnit,
  };

  const toOriginalUnit = s => num => {
    return s.state.selectedUnit
      ? convert(num)
          .from(s.state.selectedUnit)
          .to(originalUnit)
      : num;
  };
  const toDisplayUnit = s => num => {
    return s.state.selectedUnit
      ? convert(num)
          .from(originalUnit)
          .to(s.state.selectedUnit)
      : num;
  };

  const onSqonSubmit = s => () => {
    const op = s.state.selectedOperation;
    const value = [GTE_OP, GT_OP].includes(op)
      ? [s.state.maxValue]
      : [LTE_OP, LT_OP].includes(op)
        ? [s.state.minValue]
        : [s.state.minValue, s.state.maxValue];
    const sqonToSubmit = {
      op,
      content: {
        field,
        value,
      },
    };
    onSubmit(setSqonAtPath(sqonPath, sqonToSubmit)(initialSqon));
  };

  const onOptionTypeChange = s => e => {
    s.setState({
      selectedOperation: e.target.value,
    });
  };
  const onMinimumChange = s => e => {
    s.setState({
      minValue: toOriginalUnit(s)(e.target.value),
    });
  };
  const onMaximumChange = s => e => {
    s.setState({
      maxValue: toOriginalUnit(s)(e.target.value),
    });
  };
  const onClearClick = s => e => {
    s.setState({
      maxValue: max(initialFieldOp.content.value),
      minValue: min(initialFieldOp.content.value),
    });
  };

  const unitOptions = supportedConversionFromUnit(originalUnit) || [];
  const onUnitOptionSelect = s => e => {
    s.setState({
      selectedUnit: e.target.value,
    });
  };

  const isMinimumDisabled = s =>
    [LTE_OP, LT_OP].includes(s.state.selectedOperation);
  const isMaximumDisabled = s =>
    [GTE_OP, GT_OP].includes(s.state.selectedOperation);

  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <div className="filterContent">
            <div className="contentSection">
              <span>{fieldDisplayNameMap[field] || field}</span> is{' '}
              <select onChange={onOptionTypeChange(s)}>
                {RANGE_OPS.map(option => (
                  <option
                    key={option}
                    value={option}
                    selected={s.state.selectedOperation === option}
                  >
                    {opDisplayNameMap[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="contentSection">
              <span onClick={onClearClick(s)} className="aggsFilterAction">
                Clear
              </span>
            </div>
            <form className="contentSection">
              {unitOptions.map(unit => (
                <label className="unitOptionLabel" key={unit}>
                  <input
                    type="radio"
                    name={unit}
                    value={unit}
                    checked={s.state.selectedUnit === unit}
                    onChange={onUnitOptionSelect(s)}
                  />{' '}
                  {unit}
                </label>
              ))}
            </form>
            <div className="contentSection">
              <div className="rangeInputContainer">
                <div className="inputField">
                  <span
                    className={`inputLabel ${
                      isMinimumDisabled(s) ? 'disabled' : ''
                    }`}
                  >
                    From:
                  </span>
                  <InputComponent
                    disabled={isMinimumDisabled(s)}
                    value={toDisplayUnit(s)(s.state.minValue)}
                    type={'number'}
                    onChange={onMinimumChange(s)}
                  />
                </div>
                <div className="inputField">
                  <span
                    className={`inputLabel ${
                      isMaximumDisabled(s) ? 'disabled' : ''
                    }`}
                  >
                    To:
                  </span>
                  <InputComponent
                    disabled={isMaximumDisabled(s)}
                    value={toDisplayUnit(s)(s.state.maxValue)}
                    type={'number'}
                    onChange={onMaximumChange(s)}
                  />
                </div>
              </div>
            </div>
          </div>
        </ContainerComponent>
      )}
    </Component>
  );
};

const RangeFilter = ({
  sqonPath = [],
  initialSqon = null,
  onSubmit = sqon => {},
  onCancel = () => {},
  fieldDisplayNameMap = {},
  opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
  ContainerComponent = FilterContainer,
  InputComponent = props => <input {...props} />,
  unit = null,
  field,
}) => (
  <RangeFilterUi
    field={field}
    ContainerComponent={ContainerComponent}
    sqonPath={sqonPath}
    initialSqon={initialSqon}
    onSubmit={onSubmit}
    onCancel={onCancel}
    fieldDisplayNameMap={fieldDisplayNameMap}
    opDisplayNameMap={opDisplayNameMap}
    InputComponent={InputComponent}
    unit={unit}
  />
);

RangeFilter.prototype = {
  field: PropTypes.string,
  sqonPath: PropTypes.arrayOf(PropTypes.number),
  initialSqon: PropTypes.object,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  fieldDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  opDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  ContainerComponent: PropTypes.func,
  InputComponent: PropTypes.func,
  unit: PropTypes.string,
};

export default RangeFilter;
