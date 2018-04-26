import React from 'react';
import { isNil } from 'lodash';
import filesize from 'filesize';
import { getSingleValue } from './utils';
import jsonPath from 'jsonpath/jsonpath.min';
const Number = props => <div style={{ textAlign: 'right' }}>{props.value}</div>;

export default {
  number: Number,
  bits: props => (
    <Number value={filesize(props.value || 0, { base: 10 }).toUpperCase()} />
  ),
  boolean: ({ value }) => (!isNil(value) ? `${value}` : ``),
  list: props => {
    const values = jsonPath.query(props.original, props.column.jsonPath);
    const total = values.length;
    const firstValue = getSingleValue(values[0]);
    return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
  },
};
