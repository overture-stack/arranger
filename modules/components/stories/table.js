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
    {
      show: true,
      Header: 'Cases Primary Site',
      type: 'list',
      sortable: false,
      canChangeShow: false,
      query:
        'cases { hits(first: 5) { total, edges { node { primary_site } } } }',
      listAccessor: 'cases.hits.edges',
      totalAccessor: 'cases.hits.total',
      id: 'cases.primary_site',
    },
  ]),
};

const dummyData = Array(1000)
  .fill()
  .map(() => {
    const cases = Array(Math.floor(Math.random() * 10))
      .fill()
      .map(() => ({
        node: {
          primary_site: uuid(),
        },
      }));
    return {
      access: Math.random() > 0.5 ? 'controlled' : 'open',
      file_id: uuid(),
      file_name: uuid(),
      data_type: uuid(),
      file_size: Math.floor(Math.random() * 10000000),
      cases: {
        hits: {
          total: cases.length,
          edges: cases,
        },
      },
    };
  });

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

function streamDummyData({ sort, first, onData, onEnd }) {
  for (let i = 0; i < dummyData.length; i += first) {
    onData({
      total: dummyData.length,
      data: (sort
        ? orderBy(dummyData, sort.map(s => s.field), sort.map(s => s.order))
        : dummyData
      ).slice(i, i + first),
    });
  }
  onEnd();
}

storiesOf('Table', module)
  .add('Table', () => (
    <DataTable
      config={dummyConfig}
      fetchData={fetchDummyData}
      onSelectionChange={selection => console.log(selection)}
    />
  ))
  .add('Toolbar', () => <TableToolbarStory streamData={streamDummyData} />)
  .add('Data Table', () => (
    <RepoView
      config={dummyConfig}
      fetchData={fetchDummyData}
      streamData={streamDummyData}
    />
  ))
  .add('Live Data Table', () => (
    <RepoView config={tableConfig} fetchData={fetchData} />
  ));
