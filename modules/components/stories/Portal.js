import React from 'react';
import { get } from 'lodash';
import io from 'socket.io-client';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import './Aggs.css';
import SQONView from '../src/SQONView';
import State from '../src/State';
import TermAgg from '../src/Aggs/TermAgg';
import AggsState from '../src/Aggs/AggsState';
import AggsQuery from '../src/Aggs/AggsQuery';
import EditAggs from '../src/Aggs/EditAggs';
import { inCurrentSQON, addInSQON, toggleSQON } from '../src/SQONView/utils';

import DataTable, { columnTypes, columnsToGraphql } from '../src/DataTable';

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
  const API = 'http://localhost:5050';
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

let defaultSQON = {
  op: 'and',
  content: [],
};

const tableConfig = {
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

storiesOf('Portal', module).add('Exploration', () => (
  <State
    initial={{ index: '', editMode: false, sqon: null }}
    render={({ index, sqon, editMode, update }) => (
      <div>
        <label>index: </label>
        <input // <-- could be a dropdown of available indices
          value={index}
          onChange={e => update({ index: e.target.value })}
        />
        <button onClick={() => update({ editMode: !editMode })}>
          {editMode ? 'View Portal' : 'Edit Mode'}
        </button>
        <div className="app" style={{ display: 'flex' }}>
          <AggsState
            index={index}
            render={aggsState =>
              editMode ? (
                <div>
                  <EditAggs handleChange={aggsState.update} {...aggsState} />
                </div>
              ) : (
                <AggsQuery
                  debounceTime={300}
                  index={index}
                  aggs={aggsState.aggs.filter(x => x.active)}
                  render={data =>
                    data && (
                      <div>
                        {aggsState.aggs
                          .filter(x => x.active)
                          .map(agg => ({
                            ...agg,
                            ...data[index].aggregations[agg.field],
                          }))
                          .map(agg => (
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
                                  currentSQON:
                                    sqon?.content || defaultSQON.content,
                                })
                              }
                            />
                          ))}
                      </div>
                    )
                  }
                />
              )
            }
          />
          <div style={{ flexGrow: 1 }}>
            <SQONView sqon={sqon || defaultSQON} />
            <DataTable
              sqon={sqon}
              config={tableConfig}
              onSQONChange={action('sqon changed')}
              onSelectionChange={action('selection changed')}
              streamData={streamData}
              fetchData={fetchData}
            />
          </div>
        </div>
      </div>
    )}
  />
));
