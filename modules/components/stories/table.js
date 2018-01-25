import React from 'react';
import { storiesOf } from '@storybook/react';
import { compose, withState } from 'recompose';
import { orderBy, get } from 'lodash';
import uuid from 'uuid';
import io from 'socket.io-client';
import { action } from '@storybook/addon-actions';
import ThemeSwitcher, { AVAILABLE_THEMES } from '../src/ThemeSwitcher'

import DataTable, {
  Table,
  columnsToGraphql,
  TableToolbar,
  getSingleValue,
} from '../src/DataTable';

const withSQON = withState('sqon', 'setSQON', null);

const tableConfig = {
  timestamp: '2018-01-12T16:42:07.495Z',
  type: 'models',
  keyField: 'name',
  defaultSorted: [{ id: 'age_at_diagnosis', desc: false }],
  columns: [
    {
      show: true,
      Header: 'Age At Diagnosis',
      type: 'number',
      sortable: true,
      canChangeShow: true,
      accessor: 'age_at_diagnosis',
    },
    {
      show: true,
      Header: 'Name',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'name',
    },
  ],
};

const dummyConfig = {
  timestamp: '2018-01-12T16:42:07.495Z',
  type: 'files',
  keyField: 'file_id',
  defaultSorted: [{ id: 'access', desc: false }],
  columns: [
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
  ],
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

function fetchDummyData({ config, sort, offset, first }) {
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

const EnhancedDataTable = withSQON(({ sqon, setSQON }) => (
  <DataTable
    config={tableConfig}
    onSQONChange={action('sqon changed')}
    onSelectionChange={action('selection changed')}
    streamData={({ columns, sort, first, onData, onEnd }) => {
      let socket = io(`http://localhost:5050`);
      socket.on('server::chunk', ({ data, total }) =>
        onData({
          total,
          data: data[tableConfig.type].hits.edges.map(e => e.node),
        }),
      );

      socket.on('server::stream::end', onEnd);

      socket.emit('client::stream', {
        index: tableConfig.type,
        size: 100,
        ...columnsToGraphql({ columns, sort, first }),
      });
    }}
    fetchData={options => {
      const API = 'http://localhost:5050/table';

      return fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(columnsToGraphql({ ...options, sqon })),
      })
        .then(r => r.json())
        .then(r => {
          const hits = get(r, `data.${options.config.type}.hits`) || {};
          const data = get(hits, 'edges', []).map(e => e.node);
          const total = hits.total || 0;
          return { total, data };
        });
    }}
  />
));
storiesOf('Table', module)
  .add('Table', () => (
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES}>
      <Table
        config={dummyConfig}
        fetchData={fetchDummyData}
        onSelectionChange={action('selection changed')}
      />
    </ThemeSwitcher>
  ))
  .add('Toolbar', () => (
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES}>
      <TableToolbarStory
        onSQONChange={console.log.bind(console)}
        streamData={streamDummyData}
      />
    </ThemeSwitcher>
  ))
  .add('Data Table', () => (
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES}>
      <DataTable
        config={dummyConfig}
        customTypes={{
          list: props => {
            const columnList =
              get(props.original, props.column.listAccessor) || [];
            const total = get(props.original, props.column.totalAccessor);
            const firstValue = getSingleValue(columnList[0]);
            return total > 1 ? <a href="">{total} total</a> : firstValue || '';
          },
        }}
        fetchData={fetchDummyData}
        streamData={streamDummyData}
      />
    </ThemeSwitcher>
  ))
  .add('Live Data Table', () =>
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES}>
      <EnhancedDataTable />
    </ThemeSwitcher>
  );
