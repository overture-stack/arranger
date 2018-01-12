import React from 'react';
import io from 'socket.io-client';
import { get } from 'lodash';

import DataTable, {
  columnTypes,
  columnsToGraphql,
} from '@arranger/components/lib/DataTable';

const tableConfig = {
  type: 'models',
  keyField: 'id',
  defaultSorted: [],
  columns: [
    {
      show: true,
      Header: 'ID',
      type: 'string',
      sortable: false,
      canChangeShow: true,
      accessor: 'id',
    },
    {
      show: true,
      Header: 'model_growth_rate',
      type: 'number',
      sortable: true,
      canChangeShow: true,
      accessor: 'model_growth_rate',
    },
    {
      show: true,
      Header: 'Gender',
      type: 'string',
      sortable: true,
      canChangeShow: true,
      accessor: 'gender',
    },
  ],
};

function streamData({ columns, sort, first, onData, onEnd }) {
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
    ...columnsToGraphql( { columns , sort, first }),
  });
}

function fetchData(options) {
  const API = 'http://localhost:5050/table';
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(columnsToGraphql(options)),
  })
    .then(r => r.json())
    .then(r => {
      const hits = get(r, `data.${options.config.type}.hits`) || {};
      const data = get(hits, 'edges', []).map(e => e.node);
      const total = hits.total || 0;
      return { total, data };
    });
}

export default () => {
  return (
    <DataTable
      config={tableConfig}
      fetchData={fetchData}
      streamData={streamData}
    />
  );
};
