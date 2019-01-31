import React from 'react';
import Component from 'react-component-component';
import { sortBy } from 'lodash';
import './FilterContainerStyle.css';
import {
  getOperationAtPath,
  setSqonAtPath,
  FIELD_OP_DISPLAY_NAME,
} from '../utils';
import TextFilter from '../../TextFilter';
import { inCurrentSQON } from '../../SQONView/utils';
import { FilterContainer, AggsWrapper } from './common';

export const RangeFilterUi = ({
  sqonPath = [],
  initialSqon = null,
  onSubmit = sqon => {},
  onCancel = () => {},
  fieldDisplayNameMap = {},
  opDisplayNameMap = FIELD_OP_DISPLAY_NAME,
  ContainerComponent = FilterContainer,
  stats = null,
}) => {
  const initialFieldSqon = getOperationAtPath(sqonPath)(initialSqon);
  const initialState = { localSqon: initialSqon };
  const onSqonSubmit = s => () => onSubmit(s.state.localSqon);

  return (
    <Component initialState={initialState}>
      {s => (
        <ContainerComponent onSubmit={onSqonSubmit(s)} onCancel={onCancel}>
          <div>yooo!</div>
        </ContainerComponent>
      )}
    </Component>
  );
};

const mockStats = {
  max: 20,
  min: 1,
  count: 10,
};

export default ({ children, ...rest }) => (
  <RangeFilterUi stats={mockStats} {...rest}>
    {children}
  </RangeFilterUi>
);
