import React from 'react';
import filesize from 'filesize';
import { get } from 'lodash';
import { getSingleValue } from './utils';
import jsonPath from 'jsonpath';
const Number = props => <div style={{ textAlign: 'right' }}>{props.value}</div>;

export default {
  number: Number,
  bits: props => (
    <Number value={filesize(props.value || 0, { base: 10 }).toUpperCase()} />
  ),
  list: props => {
    const values = jsonPath.query(props.original, props.column.jsonPath);
    const total = values.length;
    const firstValue = getSingleValue(values[0]);
    return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
  },
};
