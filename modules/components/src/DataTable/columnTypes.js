import React from 'react';
import { format, isValid, parseISO } from 'date-fns';
import filesize from 'filesize';
import jsonPath from 'jsonpath/jsonpath.min';
import { isNil } from 'lodash';

import { getSingleValue } from './utils';

const STANDARD_DATE = 'yyyy-MM-dd';

const dateHandler = ({ value, ...props }) => {
  switch (true) {
    case isNil(value):
      return '';

    case isValid(new Date(value)):
      return format(new Date(value), STANDARD_DATE);

    case isValid(parseISO(value)):
      return format(parseISO(value), STANDARD_DATE);

    case !isNaN(parseInt(value, 10)):
      return format(parseInt(value, 10), STANDARD_DATE);

    default: {
      console.error('unhandled data', value, props);
      return value;
    }
  }
};

const Number = (props) => <div style={{ textAlign: 'right' }}>{props.value}</div>;
const FileSize = ({ options = {}, ...props }) => (
  <Number value={filesize(props.value || 0, options).toUpperCase()} />
);

export default {
  bits: ({ value, ...props }) => <FileSize {...props} value={(value || 0) / 8} />,
  boolean: ({ value }) => (isNil(value) ? '' : `${value}`),
  bytes: (props) => <FileSize {...props} />,
  date: dateHandler,
  list: (props) => {
    const values = jsonPath.query(props.original, props.column.jsonPath);
    const total = values.length;
    const firstValue = getSingleValue(values[0]);
    return [firstValue || '', ...(total > 1 ? [<br key="br" />, '...'] : [])];
  },
  number: Number,
};
