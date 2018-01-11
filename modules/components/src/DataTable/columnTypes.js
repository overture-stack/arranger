import React from 'react';
import filesize from 'filesize';
import { get } from 'lodash';
import { getSingleValue } from './utils';

const Number = props => <div style={{ textAlign: 'right' }}>{props.value}</div>;

export default {
  number: Number,
  bits: props => (
    <Number value={filesize(props.value || 0, { base: 10 }).toUpperCase()} />
  ),
  list: props => {
    const columnList = get(props.original, props.column.listAccessor) || [];
    const total = get(props.original, props.column.totalAccessor);
    const firstValue = getSingleValue(columnList[0]);
    return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
  },
};
