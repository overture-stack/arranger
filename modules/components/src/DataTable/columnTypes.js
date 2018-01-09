import React from 'react';
import filesize from 'filesize';

const Number = props => <div style={{ textAlign: 'right' }}>{props.value}</div>;
export default {
  number: Number,
  bits: props => (
    <Number value={filesize(props.value || 0, { base: 10 }).toUpperCase()} />
  ),
};
