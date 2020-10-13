import React from 'react';
import { compose } from 'recompose';

import ReactTable from 'react-table';
import checkboxHOC from 'react-table/lib/hoc/selectTable';
import 'react-table/react-table.css';

const defaultSelectInputComponent = (props) => {
  return (
    <input
      type={props.selectType || 'checkbox'}
      checked={props.checked}
      aria-label={`${props.checked ? 'Deselect' : 'Select'} ${props.id ? 'this row' : 'all rows'}`}
      onClick={(e) => {
        const { shiftKey } = e;
        e.stopPropagation();
        props.onClick(props.id, shiftKey, props.row);
      }}
      onChange={() => {}}
    />
  );
};

const withDefaultSelectInputComponent = (Component) => {
  return (props) => (
    <Component
      {...props}
      SelectInputComponent={defaultSelectInputComponent}
      SelectAllInputComponent={defaultSelectInputComponent}
    />
  );
};

const enhance = compose(withDefaultSelectInputComponent, checkboxHOC);

export default enhance(ReactTable);
