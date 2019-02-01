import React from 'react';
import Component from 'react-component-component';
import './FilterContainerStyle.css';
import {
  getOperationAtPath,
  setSqonAtPath,
  FIELD_OP_DISPLAY_NAME,
  RANGE_OPS,
} from '../utils';
import { FilterContainer } from './common';

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
}) => {
  const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon) || {
    op: '<=',
    content: { value: [], field },
  };
  const initialState = { localSqon: initialSqon };
  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);
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
  const getCurrentFieldOp = s =>
    getOperationAtPath(sqonPath)(s.state.localSqon);

  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <div>
            <span>
              {fieldDisplayNameMap[initialFieldSqon.content.field] ||
                initialFieldSqon.content.field}
            </span>{' '}
            is{' '}
            <select onChange={onOptionTypeChange(s)}>
              {RANGE_OPS.map(option => (
                <option
                  key={option}
                  value={option}
                  selected={getCurrentFieldOp(s).op === option}
                >
                  {opDisplayNameMap[option]}
                </option>
              ))}
            </select>
            <div>
              <InputComponent
                value={getCurrentFieldOp(s).content.value[0]}
                type={'number'}
                onChange={onMinimumChange(s)}
              />
              <InputComponent
                value={getCurrentFieldOp(s).content.value[1]}
                type={'number'}
                onChange={onMaximumChange(s)}
              />
            </div>
          </div>
        </ContainerComponent>
      )}
    </Component>
  );
};

export default ({
  sqonPath = [],
  initialSqon = null,
  onSubmit = sqon => {},
  onCancel = () => {},
  fieldDisplayNameMap = {},
  opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
  ContainerComponent = FilterContainer,
  InputComponent = props => <input {...props} />,
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
    />
  );
};
