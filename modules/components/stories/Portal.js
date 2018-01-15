import React from 'react';
import { get } from 'lodash';
import io from 'socket.io-client';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import './Aggs.css';
import SQONView from '../src/SQONView';
import State from '../src/State';
import TermAgg from '../src/Aggs/TermAgg';
import { inCurrentSQON, addInSQON, toggleSQON } from '../src/SQONView/utils';

import DataTable, { columnTypes, columnsToGraphql } from '../src/DataTable';

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
    ...columnsToGraphql({ columns, sort, first }),
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

let Table = () => {
  return (
    <DataTable
      config={tableConfig}
      fetchData={fetchData}
      streamData={streamData}
    />
  );
};

let aggs = [
  {
    field: 'color',
    displayName: 'Color',
    active: false,
    type: 'Aggregations',
    allowedValues: [],
    restricted: false,
    buckets: [
      {
        doc_count: 1,
        key: 'green',
      },
      {
        doc_count: 5,
        key: 'yellow',
      },
      {
        doc_count: 12,
        key: 'blue',
      },
    ],
  },
  {
    field: 'taste',
    displayName: 'Taste',
    active: false,
    type: 'Aggregations',
    allowedValues: [],
    restricted: false,
    buckets: [
      {
        doc_count: 1,
        key: 'spicy',
      },
      {
        doc_count: 5,
        key: 'sweet',
      },
      {
        doc_count: 12,
        key: 'sour',
      },
    ],
  },
];

let defaultSQON = {
  op: 'and',
  content: [],
};

storiesOf('Portal', module).add('Exploration', () => (
  <State
    initial={{ sqon: null }}
    render={({ sqon, update }) => (
      <div className="app" style={{ display: 'flex' }}>
        <div>
          {aggs.map(agg => (
            // TODO: switch on agg type
            <TermAgg
              key={agg.field}
              {...agg}
              Content={({ content, ...props }) => (
                <div
                  {...props}
                  onClick={() =>
                    update({
                      sqon: toggleSQON(
                        {
                          op: 'and',
                          content: [
                            {
                              op: 'in',
                              content,
                            },
                          ],
                        },
                        sqon || defaultSQON,
                      ),
                    })
                  }
                />
              )}
              isActive={d =>
                inCurrentSQON({
                  value: d.value,
                  dotField: d.field,
                  currentSQON: sqon?.content || defaultSQON.content,
                })
              }
            />
          ))}
        </div>
        <div style={{ flexGrow: 1 }}>
          <SQONView sqon={sqon || defaultSQON} />
          <Table />
        </div>
      </div>
    )}
  />
));
