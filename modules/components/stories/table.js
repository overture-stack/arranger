import React from 'react';
import { storiesOf } from '@storybook/react';
import { compose, withState } from 'recompose';
import { orderBy, get } from 'lodash';
import uuid from 'uuid';
import io from 'socket.io-client';
import { action } from '@storybook/addon-actions';
import { ARRANGER_API } from '../src/utils/config';
import DataTable, {
  Table,
  columnsToGraphql,
  TableToolbar,
  getSingleValue,
} from '../src/DataTable';
import { themeDecorator } from './decorators';
import api from '../src/utils/api';

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
      let socket = io(ARRANGER_API);
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
      return api({
        endpoint: 'table',
        body: columnsToGraphql({ ...options, sqon }),
      }).then(r => {
        const hits = get(r, `data.${options.config.type}.hits`) || {};
        const data = get(hits, 'edges', []).map(e => e.node);
        const total = hits.total || 0;
        return { total, data };
      });
    }}
  />
));

storiesOf('Table', module)
  .addDecorator(themeDecorator)
  .addDecorator(story => (
    <div
      style={{
        position: 'absolute',
        left: '0px',
        right: '0px',
        top: '50px',
        bottom: '0px',
      }}
    >
      {story()}
    </div>
  ))
  .add('Table', () => (
    <Table
      config={dummyConfig}
      fetchData={fetchDummyData}
      onSelectionChange={action('selection changed')}
    />
  ))
  .add('Toolbar', () => (
    <TableToolbarStory
      onSQONChange={console.log.bind(console)}
      onFilterChange={console.log.bind(console)}
      streamData={streamDummyData}
    />
  ))
  .add('Data Table', () => (
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
  ))
  .add('Live Data Table', () => <EnhancedDataTable />);
