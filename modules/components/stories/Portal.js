import React from 'react';
import { get } from 'lodash';
import io from 'socket.io-client';
import { injectGlobal } from 'emotion';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { api } from '../src/Admin/Dashboard';
import SQONView, { Value, Bubble } from '../src/SQONView';
import State from '../src/State';
import TermAgg from '../src/Aggs/TermAgg';
import AggsState from '../src/Aggs/AggsState';
import AggsQuery from '../src/Aggs/AggsQuery';

import { inCurrentSQON, toggleSQON, setSQON } from '../src/SQONView/utils';
import ThemeSwitcher, { AVAILABLE_THEMES } from '../src/ThemeSwitcher';
import DataTable, {
  EditColumns,
  ColumnsState,
  columnsToGraphql,
} from '../src/DataTable';

let API =
  process.env.STORYBOOK_API ||
  localStorage.STORYBOOK_API ||
  'http://localhost:5050';

let socket = io(API);

function streamData({ columns, sort, first, onData, onEnd }) {
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

const eshost =
  process.env.STORYBOOK_ES_HOST ||
  localStorage.ES_HOST ||
  'http://localhost:9200';

const fetchData = projectId => {
  return options => {
    return api({
      endpoint: `/${projectId}/graphql`,
      headers: {
        ES_HOST: eshost,
      },
      body: columnsToGraphql(options),
    }).then(r => {
      const hits = get(r, `data.${options.config.type}.hits`) || {};
      const data = get(hits, 'edges', []).map(e => e.node);
      const total = hits.total || 0;
      return { total, data };
    });
  };
};

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

<<<<<<< HEAD
class GetProjects extends React.Component {
  state = { projects: [] };
  async componentDidMount() {
    let { projects, total, error } = await api({
      endpoint: '/projects',
      body: { eshost },
    });

    projects = await this.addTypesToProjects(projects);

    this.setState({ projects });
  }

  addTypesToProjects = projects =>
    Promise.all(
      projects.map((x, i) =>
        api({
          endpoint: `/projects/${x.id}/types`,
          body: { eshost },
        }).then(data => ({
          ...projects[i],
          types: data,
        })),
      ),
    );

  render() {
    return this.state.projects.length > 0 && this.props.render(this.state);
  }
}

injectGlobal`
  html,
  body,
  #root {
    height: 100vh;
    margin: 0;
  }
`;

class App extends React.Component {
  state = { shouldRefresh: false };
  componentDidMount() {
    socket.on('server::refresh', () => {
      this.setState({ shouldRefresh: true });
    });
  }
  render() {
    return (
      <>
        {this.state.shouldRefresh && (
=======
storiesOf('Portal', module).add('Exploration', () => (
  <State
    initial={{ index: '', projectId: '', editMode: false, sqon: null }}
    render={({ index, projectId, sqon, editMode, update }) => (
      <div>
        <ThemeSwitcher availableThemes={AVAILABLE_THEMES} />
        <label>index: </label>
        <input // <-- could be a dropdown of available indices
          value={index}
          onChange={e => update({ index: e.target.value })}
        />
        <label>projectId: </label>
        <input
          value={projectId}
          onChange={e => update({ projectId: e.target.value })}
        />
        <button onClick={() => update({ editMode: !editMode })}>
          {editMode ? 'View Portal' : 'Edit Mode'}
        </button>
        <div className="app" style={{ display: 'flex' }}>
          <div className="aggs-panel">
            <AggsState
              projectId={projectId}
              index={index}
              render={aggsState => {
                console.log(123, aggsState);
                return editMode ? (
                  <div>
                    <EditAggs handleChange={aggsState.update} {...aggsState} />
                  </div>
                ) : (
                  <AggsQuery
                    debounceTime={300}
                    projectId={projectId}
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
                              ...data[index].extended.find(
                                x => x.field === agg.field,
                              ),
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
                );
              }}
            />
          </div>
>>>>>>> 38bcf7c... puts back bad normalization
          <div
            css={`
              z-index: 10000;
              position: fixed;
              bottom: 20px;
              right: 20px;
              background: #383838;
              color: white;
              padding: 10px;
              border-radius: 6px;
            `}
          >
            A new version of this app is available.{' '}
            <span
              css={`
                cursor: pointer;
                color: rgb(154, 232, 229);
                font-weight: bold;
              `}
              onClick={() => (window.location.href = window.location.href)}
            >
              REFRESH
            </span>
          </div>
        )}
        {this.props.children}
      </>
    );
  }
}

storiesOf('Portal', module).add('Exploration', () => (
  <App>
    <State
      initial={{
        index: localStorage.demoIndex,
        projectId: localStorage.demoProject,
        sqon: null,
      }}
      render={({ index, projectId, sqon, update }) => (
        <div
          style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
        >
          <div>
            <span
              css={`
                opacity: 0;
                position: absolute;
                left: -999px;
              `}
            >
              <ThemeSwitcher availableThemes={AVAILABLE_THEMES} />
            </span>
            {(!index || !projectId) && (
              <div
                css={`
                  height: 100vh;
                  display: flex;
                  flex-directon: column;
                  justify-content: center;
                  align-items: center;
                `}
              >
                <div
                  css={`
                    display: flex;
                    flex-direction: column;
                  `}
                >
                  <GetProjects
                    render={({ projects }) => (
                      <>
                        <h2>
                          {process.env.STORYBOOK_PORTAL_NAME ||
                            process.env.STORYBOOK_PORTAL_NAME ||
                            'Data Portal'}
                        </h2>
                        <select
                          value={projectId}
                          onChange={e => {
                            localStorage.demoProject = e.target.value;
                            update({
                              projectId: e.target.value,
                            });
                          }}
                        >
                          <option id="version">Select a version</option>
                          {projects.map(x => (
                            <option key={x.id} value={x.id}>
                              {x.id}
                            </option>
                          ))}
                        </select>
                        <select
                          value={index}
                          onChange={e => {
                            localStorage.demoIndex = e.target.value;
                            update({
                              index: e.target.value,
                            });
                          }}
                        >
                          <option id="version">Select an index</option>
                          {projects
                            .find(x => x.id === projectId)
                            ?.types?.types?.map(x => (
                              <option key={x.index} value={x.index}>
                                {x.index}
                              </option>
                            ))}
                        </select>
                      </>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
          {index &&
            projectId && (
              <div className="portal">
                <div
                  css={`
                    display: flex;
                    line-height: 40px;
                    padding: 0 20px;
                    font-size: 20px;
                    font-weight: bold;
                    box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14),
                      0 1px 10px 0 rgba(0, 0, 0, 0.12),
                      0 2px 4px -1px rgba(0, 0, 0, 0.3);
                  `}
                >
                  {process.env.STORYBOOK_PORTAL_NAME ||
                    process.env.STORYBOOK_PORTAL_NAME ||
                    'Data Portal'}{' '}
                  Search Page
                  <div
                    css={`
                      margin-left: auto;
                      cursor: pointer;
                    `}
                    onClick={() => {
                      delete localStorage.demoProject;
                      delete localStorage.demoIndex;
                      update({ index: '', projectId: '' });
                    }}
                  >
                    Logout
                  </div>
                </div>
                <div style={{ display: 'flex', flexGrow: 1 }}>
                  <AggsState
                    projectId={projectId}
                    index={index}
                    render={aggsState => {
                      return (
                        <AggsQuery
                          debounceTime={300}
                          projectId={projectId}
                          index={index}
                          aggs={aggsState.aggs.filter(x => x.active)}
                          render={data =>
                            data && (
                              <div
                                css={`
                                  width: 300px;
                                `}
                              >
                                {aggsState.aggs
                                  .filter(x => x.active)
                                  .map(agg => ({
                                    ...agg,
                                    ...data[index].aggregations[agg.field],
                                    ...data[index].extended.find(
                                      x => x.field === agg.field,
                                    ),
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
                                                      content: {
                                                        ...content,
                                                        value: [].concat(
                                                          content.value || [],
                                                        ),
                                                      },
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
                                            sqon?.content ||
                                            defaultSQON.content,
                                        })
                                      }
                                    />
                                  ))}
                              </div>
                            )
                          }
                        />
                      );
                    }}
                  />
                  <div
                    css={`
                      position: relative;
                      flex-grow: 1;
                      display: flex;
                      flex-direction: column;
                    `}
                  >
                    <SQONView
                      sqon={sqon || defaultSQON}
                      ValueCrumb={({ value, nextSQON, ...props }) => (
                        <Value
                          onClick={() => update({ sqon: nextSQON })}
                          {...props}
                        >
                          {value}
                        </Value>
                      )}
                      Clear={({ nextSQON }) => (
                        <Bubble
                          className="sqon-clear"
                          onClick={() => update({ sqon: nextSQON })}
                        >
                          Clear
                        </Bubble>
                      )}
                    />
                    <ColumnsState
                      projectId={projectId}
                      index={index}
                      render={columnState => {
                        return (
                          <DataTable
                            sqon={sqon}
                            config={columnState.state}
                            onSQONChange={action('sqon changed')}
                            onSelectionChange={action('selection changed')}
                            streamData={streamData}
                            fetchData={fetchData(projectId)}
                          />
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
        </div>
      )}
    />
  </App>
));
