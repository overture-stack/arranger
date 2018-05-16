import ReactTable from 'react-table';
import { compose, defaultProps, branch } from 'recompose';
import checkboxHOC from 'react-table/lib/hoc/selectTable';

// import dragColumnsHOC from './dragColumnsHOC';

import 'react-table/react-table.css';

const enhance = compose(
  // dragColumnsHOC,
  defaultProps({ hasCheckbox: true }),
  branch(props => props.hasCheckbox, checkboxHOC),
);

export default enhance(ReactTable);
