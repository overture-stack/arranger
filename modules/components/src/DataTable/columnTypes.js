import React from 'react';
import { isNil } from 'lodash';
import filesize from 'filesize';
import { getSingleValue } from './utils';
import jsonPath from 'jsonpath/jsonpath.min';

const Number = props => <div style={{ textAlign: 'right' }}>{props.value}</div>;
const FileSize = ({ options = {}, ...props }) => (
  <Number value={filesize(props.value || 0, options).toUpperCase()} />
);

export default {
  number: Number,
  bits: ({ value, ...props }) => (
    <FileSize {...props} value={(value || 0) / 8} />
  ),
  bytes: props => <FileSize {...props} />,
  boolean: ({ value }) => (!isNil(value) ? `${value}` : ``),
  list: props => {
    const values = jsonPath.query(props.original, props.column.jsonPath);
    const total = values.length;
    const firstValue = getSingleValue(values[0]);
    return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
  },
};
