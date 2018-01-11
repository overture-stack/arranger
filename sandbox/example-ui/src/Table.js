import React from 'react';
import io from 'socket.io-client';
import { get } from 'lodash';

import {
  RepoView,
  columnTypes,
  columnsToGraphql,
} from '@arranger/components/lib/DataTable';

function normalizeColumns(columns) {
  return columns.map(function(column) {
    return {
      ...column,
      show: typeof column.show === 'boolean' ? column.show : true,
      Cell: column.Cell || columnTypes[column.type],
    };
  });
}

const tableConfig = {
  type: 'models',
  keyField: 'id',
  defaultSorted: [],
  columns: normalizeColumns([
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
      Header: 'Gender',
      type: 'string',
      sortable: false,
      canChangeShow: true,
      accessor: 'gender',
    },
  ]),
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
    ...columnsToGraphql({ columns }, { sort, first }),
  });
}

export default () => {
  return (
    <RepoView
      config={tableConfig}
      fetchData={(config, ...args) => {
        const API = 'http://localhost:5050/table';
        return fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(columnsToGraphql(config, ...args)),
        })
          .then(r => r.json())
          .then(r => {
            const hits = get(r, `data.${config.type}.hits`) || {};
            const data = get(hits, 'edges', []).map(e => e.node);
            const total = hits.total || 0;
            return { total, data };
          });
      }}
      streamData={streamData}
    />
  );
};
