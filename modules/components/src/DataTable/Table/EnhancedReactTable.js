import ReactTable from 'react-table';
import { compose } from 'recompose';
import checkboxHOC from './checkboxHOC';

// import dragColumnsHOC from './dragColumnsHOC';

import 'react-table/react-table.css';

const enhance = compose(
  // dragColumnsHOC,
  checkboxHOC,
);

export default enhance(ReactTable);
