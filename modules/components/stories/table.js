import React from 'react';
import { storiesOf } from '@storybook/react';
import { compose, withState } from 'recompose';
import { orderBy } from 'lodash';
import uuid from 'uuid';
import DataTable, {
  columnConfig,
  columnTypes,
  fetchData,
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

const dummyConfig = {
  type: 'files',
  keyField: 'file_id',
  defaultSorted: [{ id: 'access', desc: false }],
  columns: normalizeColumns([
    {
      show: true,
      Header: 'Access',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'access',
    },
    {
      show: true,
      Header: 'File Id',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'file_id',
    },
    {
      show: true,
      Header: 'File Name',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'file_name',
    },
    {
      show: true,
      Header: 'Data Type',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'data_type',
    },
    {
      show: true,
      Header: 'File Size',
      type: 'bits',
      sortable: true,
      canChangeShow: true,
      accessor: 'file_size',
    },
  ]),
};

const dummyData = Array(1000)
  .fill()
  .map(() => ({
    access: Math.random() > 0.5 ? 'controlled' : 'open',
    file_id: uuid(),
    file_name: uuid(),
    data_type: uuid(),
    file_size: Math.floor(Math.random() * 10000000),
  }));

const withColumns = compose(
  withState('columns', 'onColumnsChange', dummyConfig.columns),
);

const TableToolbarStory = withColumns(TableToolbar);

function fetchDummyData(config, { sort, offset, first }) {
  return Promise.resolve({
    total: dummyData.length,
    data: orderBy(
      dummyData,
      sort.map(s => s.field),
      sort.map(s => s.order),
    ).slice(offset, offset + first),
  });
}

storiesOf('Table', module)
  .add('Table', () => (
    <DataTable
      config={dummyConfig}
      fetchData={fetchDummyData}
      onSelectionChange={selection => console.log(selection)}
    />
  ))
  .add('Toolbar', () => <TableToolbarStory />)
  .add('Data Table', () => (
    <RepoView config={dummyConfig} fetchData={fetchDummyData} />
  ))
  .add('Live Data Table', () => (
    <RepoView config={tableConfig} fetchData={fetchData} />
  ));
