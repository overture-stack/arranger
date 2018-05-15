import ReactTable from 'react-table';
import { compose, branch } from 'recompose';
import checkboxHOC from 'react-table/lib/hoc/selectTable';

// import dragColumnsHOC from './dragColumnsHOC';

import 'react-table/react-table.css';

const enhance = compose(
  // dragColumnsHOC,
  branch(
    props => ('hasCheckbox' in props ? props.hasCheckbox : true),
    checkboxHOC,
  ),
);

export default enhance(ReactTable);
