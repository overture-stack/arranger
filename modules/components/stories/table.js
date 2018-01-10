import React from 'react';
import { storiesOf } from '@storybook/react';
import { compose, withState } from 'recompose';

import DataTable, {
  columnConfig,
  fetchData,
  columnTypes,
  TableToolbar,
} from '../src/DataTable';

import { RepoView } from '../src/DataTable/RepoView/index';

const tableConfig = {
  ...columnConfig.files,
  columns: normalizeColumns(columnConfig.files.columns),
};

function normalizeColumns(columns) {
  return columns.map(function(column) {
    return {
      ...column,
      show: typeof column.show === 'boolean' ? column.show : true,
      Cell: column.Cell || columnTypes[column.type],
    };
  });
}

const withColumns = compose(
  withState('columns', 'onColumnsChange', tableConfig.columns),
);

const TableToolbarStory = withColumns(TableToolbar);

storiesOf('Table', module)
  .add('Table', () => (
    <DataTable
      config={tableConfig}
      fetchData={fetchData}
      onSelectionChange={selection => console.log(selection)}
    />
  ))
  .add('Toolbar', () => <TableToolbarStory />)
  .add('Data Table', () => <RepoView config={tableConfig} />);
