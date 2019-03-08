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

export const RangeFilterUi = ({
  field = '',
  sqonPath = [],
  initialSqon = null,
  onSubmit = sqon => {},
  onCancel = () => {},
  fieldDisplayNameMap = {},
  opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
  ContainerComponent = FilterContainer,
  InputComponent = props => <input {...props} />,
  fieldType,
  unit: originalUnit = null,
}) => {
  const initialFieldOp = (() => {
    const fieldOp = getOperationAtPath(sqonPath)(initialSqon);
    return fieldOp
      ? normalizeNumericFieldOp(fieldOp)
      : {
          op: BETWEEN_OP,
          content: { value: [], field },
        };
  })();
  const initialState = { localSqon: initialSqon, selectedUnit: originalUnit };

  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);
  const getCurrentFieldOp = s =>
    getOperationAtPath(sqonPath)(s.state.localSqon);
  const onOptionTypeChange = s => e => {
    const currentFieldSqon = getOperationAtPath(sqonPath)(s.state.localSqon);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        op: e.target.value,
      })(s.state.localSqon),
    });
  };
  const onMinimumChange = s => e => {
    const currentFieldSqon = getCurrentFieldOp(s);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [e.target.value, currentFieldSqon.content.value[1]],
        },
      })(s.state.localSqon),
    });
  };
  const onMaximumChange = s => e => {
    const currentFieldSqon = getCurrentFieldOp(s);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [currentFieldSqon.content.value[0], e.target.value],
        },
      })(s.state.localSqon),
    });
  };
  const onClearClick = s => e => {
    const currentFieldSqon = getCurrentFieldOp(s);
    s.setState({
      localSqon: setSqonAtPath(sqonPath, {
        ...currentFieldSqon,
        content: {
          ...currentFieldSqon.content,
          value: [0, 0],
        },
      })(s.state.localSqon),
    });
  };

  const unitOptions = supportedConversionFromUnit(originalUnit);
  const onUnitOptionSelect = s => e => {
    s.setState({
      selectedUnit: e.target.value,
    });
  };

  return (
    <Component initialState={initialState}>
      {s => {
        const currentFieldOp = getCurrentFieldOp(s);
        return (
          <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
            <div className="filterContent">
              <div className="contentSection">
                <span>
                  {fieldDisplayNameMap[initialFieldOp.content.field] ||
                    initialFieldOp.content.field}
                </span>{' '}
                is{' '}
                <select onChange={onOptionTypeChange(s)}>
                  {RANGE_OPS.map(option => (
                    <option
                      key={option}
                      value={option}
                      selected={currentFieldOp.op === option}
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
                  {![GTE_OP, GT_OP].includes(currentFieldOp.op) && (
                    <div className="inputField">
                      <span className="inputLabel">From:</span>
                      <span className="inputSecondaryLabel">min: </span>
                      <InputComponent
                        value={currentFieldOp.content.value[0]}
                        type={'number'}
                        onChange={onMinimumChange(s)}
                      />
                    </div>
                  )}
                  {![LTE_OP, LT_OP].includes(currentFieldOp.op) && (
                    <div className="inputField">
                      <span className="inputLabel">To:</span>
                      <span className="inputSecondaryLabel">max: </span>
                      <InputComponent
                        value={currentFieldOp.content.value[1]}
                        type={'number'}
                        onChange={onMaximumChange(s)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ContainerComponent>
        );
      }}
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
  fieldType,
  unit = null,
}) => {
  return (
    <RangeFilterUi
      ContainerComponent={ContainerComponent}
      sqonPath={sqonPath}
      initialSqon={initialSqon}
      onSubmit={onSubmit}
      onCancel={onCancel}
      fieldDisplayNameMap={fieldDisplayNameMap}
      opDisplayNameMap={opDisplayNameMap}
      InputComponent={InputComponent}
      fieldType={fieldType}
      unit={unit}
    />
  );
};

RangeFilter.prototype = {
  sqonPath: PropTypes.arrayOf(PropTypes.number),
  initialSqon: PropTypes.object,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  fieldDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  opDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  ContainerComponent: PropTypes.func,
  InputComponent: PropTypes.func,
  fieldType: PropTypes.string.isRequired,
  unit: PropTypes.string,
};

export default RangeFilter;
