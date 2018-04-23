import React from 'react';

export const Option = ({ value, children, ...props }) => (
  <option value={value} {...props}>
    {children}
  </option>
);

const Select = ({ children, ...props }) => (
  <select {...props}>{children}</select>
);

export default Select;
