import React from 'react';
import filesize from 'filesize';
import { get } from 'lodash';

const Number = props => <div style={{ textAlign: 'right' }}>{props.value}</div>;
function getSingleValue(data) {
  if (typeof data === 'object') {
    return getSingleValue(Object.values(data)[0]);
  } else {
    return data;
  }
}
export default {
  number: Number,
  bits: props => (
    <Number value={filesize(props.value || 0, { base: 10 }).toUpperCase()} />
  ),
  list: props => {
    const columnList = get(props.original, props.column.listAccessor) || [];
    const total = get(props.original, props.column.totalAccessor);
    const firstValue = getSingleValue(columnList[0]);
    return [firstValue || '', ...(total > 1 ? [<br />, '...'] : [])];
  },
};
