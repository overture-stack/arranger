import React from 'react';
import Component from 'react-component-component';
import { debounce, startCase, pick } from 'lodash';
import { BrowserRouter, Route, Link, Redirect, Switch } from 'react-router-dom';
import convert from 'convert-units';

// TODO: importing this causes "multiple versions" of graphql to be loaded and throw error
// import GraphiQL from 'graphiql';
// import 'graphiql/graphiql.css';

import CaretDownIcon from 'react-icons/lib/fa/caret-down';
import CaretUpIcon from 'react-icons/lib/fa/caret-up';

import DetectNewVersion from '../Arranger/DetectNewVersion';
import State from '../State';
import Header from './Header';
import ProjectsTable from './ProjectsTable';
import TypesTable from './TypesTable';
import { ES_HOST } from '../utils/config';
import api from '../utils/api';
import initSocket from '../utils/initSocket';
import AggregationsTab from './Tabs/Aggregations/AggregationsTab';
import TableTab from './Tabs/Aggregations/TableTab';
import MatchBoxTab from './Tabs/MatchBoxTab';

class Dashboard extends React.Component {
  constructor(props) {
    super(props);

    let socket = initSocket(
      pick(props, ['socket', 'socketConnectionString', 'socketOptions']),
    );

    this.state = {
      eshost: ES_HOST,
      error: null,

      projects: [],
      projectsTotal: 0,
      newProjectName: '',
      activeProject: null,
      projectStates: [],

      newTypeIndex: '',
      newTypeName: '',
      newTypeEsType: '',
      types: [],
      typesTotal: 0,
      activeType: null,

      fields: [],
      fieldsTotal: 0,
      activeField: null,
      socket,
    };
  }

  componentDidMount() {
    require('./Dashboard.css');

    this.getProjects({ eshost: this.state.eshost });

    this.state.socket.io.on('connect_error', error => {
      this.setState({ error: error.message });
    });

    this.state.socket.io.on('reconnect', a => {
      this.setState({ error: null });
    });

    this.state.socket.on('server::projectsStatus', projectStates => {
      this.setState({ projectStates });
    });
  }

  getProjects = debounce(async ({ eshost }) => {
    let { projects, total, error } = await api({
      endpoint: '/projects',
      body: { eshost },
    });

    if (error) {
      this.setState({
        error,
        projects: [],
        types: [],
        activeProject: null,
        projectsTotal: 0,
        typesTotal: 0,
      });
    }

    if (!error) {
      let projectsWithTypes = await this.addTypesToProjects(projects);

      const activeProject = window.location.pathname.split('/')[2];
      this.setState({
        projects: projectsWithTypes,
        projectsTotal: total,
        activeProject: projectsWithTypes.some(p => p.id === activeProject)
          ? activeProject
          : null,
        error: null,
        fields: [],
        types: [],
        typesTotal: 0,
        fieldsTotal: 0,
        activeField: null,
        activeType: null,
      });

      this.state.socket.emit('arranger::monitorProjects', {
        projects,
        eshost,
      });
    }
  }, 300);

  updateProjectField = async ({ id, field, value }) => {
    let { projects, error } = await api({
      endpoint: `/projects/${id}/update`,
      body: { eshost: this.state.eshost, field, value },
    });

    if (error) {
      this.setState({
        error,
        projects: [],
        types: [],
        activeProject: null,
        projectsTotal: 0,
        typesTotal: 0,
      });
    }

    if (!error) {
      let projectsWithTypes = await this.addTypesToProjects(projects);

      this.setState({
        projects: projectsWithTypes,
        error: null,
      });
    }
  };

  addTypesToProjects = projects =>
    Promise.all(
      projects.map((x, i) =>
        api({
          endpoint: `/projects/${x.id}/types`,
          body: { eshost: this.state.eshost },
        }).then(data => ({
          ...projects[i],
          types: data,
          delete: () => (
            <div
              css={`
                cursor: pointer;
                text-align: center;
              `}
              onClick={() => this.deleteProject({ id: x.id })}
            >
              🔥
            </div>
          ),
          active: () => (
            <div
              css={`
                cursor: pointer;
                text-align: center;
              `}
            >
              <span
                onClick={() =>
                  this.updateProjectField({
                    id: x.id,
                    field: 'active',
                    value: true,
                  })
                }
                css={`
                  border-bottom: ${x.active ? '2px solid green' : 'none'};
                `}
              >
                ✅
              </span>{' '}
              <span
                onClick={() =>
                  this.updateProjectField({
                    id: x.id,
                    field: 'active',
                    value: false,
                  })
                }
                css={`
                  border-bottom: ${!x.active ? '2px solid green' : 'none'};
                `}
              >
                Ⓧ
              </span>
            </div>
          ),
          spinup: () => (
            <div
              css={`
                cursor: pointer;
                text-align: center;
              `}
              onClick={() => this.spinup({ id: x.id })}
            >
              ⚡️
            </div>
          ),
          teardown: () => (
            <div
              css={`
                cursor: pointer;
                text-align: center;
              `}
              onClick={() => this.teardown({ id: x.id })}
            >
              💤
            </div>
          ),
          endpointStatus: () => (
            <div
              css={`
                cursor: pointer;
                text-align: center;
              `}
            >
              {this.state.projectStates.find(p => p.id === x.id)?.status ===
                400 && (
                <span
                  css={`
                    color: rgb(164, 21, 46);
                    font-size: 25px;
                  `}
                >
                  <CaretDownIcon />
                </span>
              )}
              {this.state.projectStates.find(p => p.id === x.id)?.status ===
                200 && (
                <span
                  css={`
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgb(21, 164, 66);
                    font-size: 25px;
                  `}
                >
                  <CaretUpIcon />

                  <Link to={`/graphiql/${x.id}`}>
                    <img
                      css={`
                        width: 15px;
                      `}
                      alt="graphiql"
                      src="
                    https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/GraphQL_Logo.svg/128px-GraphQL_Logo.svg.png"
                    />
                  </Link>
                </span>
              )}
            </div>
          ),
        })),
      ),
    );

  addProject = async () => {
    let { projects, total, error } = await api({
      endpoint: '/projects/add',
      body: { eshost: this.state.eshost, id: this.state.newProjectName },
    });

    if (error) {
      this.setState({ error });
    }

    if (!error) {
      let projectsWithTypes = await this.addTypesToProjects(projects);

      this.setState({
        projects: projectsWithTypes,
        projectsTotal: total,
        activeProject: this.state.newProjectName,
        newProjectName: '',
        error: null,
        typesTotal: 0,
        types: [],
        fields: [],
        activeField: null,
        activeType: null,
      });
    }
  };

  deleteType = async ({ projectId, index }) => {
    let { projects, error } = await api({
      endpoint: `/projects/${projectId}/types/${index}/delete`,
      body: { eshost: this.state.eshost },
    });
    if (error) {
      this.setState({ error });
    }
    if (!error) {
      let projectsWithTypes = await this.addTypesToProjects(projects);
      this.setState({ projects: projectsWithTypes });
    }
  };

  deleteProject = async ({ id }) => {
    let { projects, total, error } = await api({
      endpoint: `/projects/${id}/delete`,
      body: { eshost: this.state.eshost },
    });

    if (error) {
      this.setState({ error });
    }

    if (!error) {
      let projectsWithTypes = await this.addTypesToProjects(projects);

      this.setState({
        projects: projectsWithTypes,
        projectsTotal: total,
        types: [],
        activeProject: null,
        error: null,
      });
    }
  };

  getFields = async ({ activeType, projectId }) => {
    let { fields, total, error } = await api({
      endpoint: `/projects/${projectId}/types/${activeType}/fields`,
      body: { eshost: this.state.eshost },
    });

    if (error) {
      this.setState({ error });
    }

    if (!error) {
      this.setState({ fields, fieldsTotal: total, error: null });
    }
  };

  getTypes = async () => {
    let { types, total, error } = await api({
      endpoint: `/projects/${this.state.activeProject}/types`,
      body: { eshost: this.state.eshost },
    });

    if (error) {
      this.setState({ error });
    }

    if (!error) {
      this.setState({ types, typesTotal: total, error: null });
    }
  };

  addType = async () => {
    let { types, total, error } = await api({
      endpoint: `/projects/${this.state.activeProject}/types/add`,
      body: {
        eshost: this.state.eshost,
        index: this.state.newTypeIndex,
        name: this.state.newTypeName,
        type: this.state.newTypeEsType,
      },
    });

    if (error) {
      this.setState({ error });
    }

    if (!error) {
      let projectsWithTypes = await this.addTypesToProjects(
        this.state.projects,
      );

      this.setState({
        types,
        projects: projectsWithTypes,
        typesTotal: total,
        newTypeIndex: '',
        newTypeName: '',
        newTypeEsType: '',
        error: null,
      });
    }
  };

  spinup = async ({ id }) => {
    await api({
      endpoint: `/projects/${id}/spinup`,
      body: {
        eshost: this.state.eshost,
        id,
      },
    });
  };

  teardown = async ({ id }) => {
    await api({
      endpoint: `/projects/${id}/teardown`,
      body: {
        eshost: this.state.eshost,
        id,
      },
    });
  };

  redeployServer = async () => {
    await api({
      endpoint: `/restartServer`,
    });
  };

  render() {
    let headerHeight = 38;
    let { activeField, error, eshost, projects, socket } = this.state;
    return (
      <BrowserRouter basename={this.props.basename || ''}>
        <div
          className="dashboard"
          css={`
            display: flex;
            flex-direction: column;
          `}
        >
          <DetectNewVersion
            socket={socket}
            event="server::newServerVersion"
            Message={() => {
              return (
                <div>
                  A newer version of the Arranger server is available.
                  <span
                    css={`
                      cursor: pointer;
                      color: rgb(154, 232, 229);
                      font-weight: bold;
                    `}
                    onClick={this.redeployServer}
                  >
                    &nbsp;DEPLOY
                  </span>
                </div>
              );
            }}
          />
          <Header
            css={`
              flex: none;
            `}
            eshost={eshost}
            height={headerHeight}
            handleOnChange={e => {
              localStorage.ES_HOST = e.target.value;
              let state = { eshost: e.target.value };
              this.setState(state);
              this.getProjects(state);
            }}
          />
          {error && (
            <div
              className="error"
              css={`
                flex: none;
              `}
            >
              ⚠️ {error}
            </div>
          )}

          <Route
            render={p =>
              // needed for storybook
              p.location.pathname === '/iframe.html' && <Redirect to={'/'} />
            }
          />
          <Route // breadcrums
            render={p => {
              let split = p.location.pathname.split('/');
              return (
                <div
                  css={`
                    line-height: ${headerHeight}px;
                    padding: 0 10px;
                    flex: none;
                  `}
                >
                  {split.reduce((breadCrumbs, segment, i) => {
                    const path = split.slice(0, i + 1).join(`/`);
                    return [
                      ...breadCrumbs,
                      <React.Fragment key={path}>
                        <Link
                          to={path}
                          css={`
                            text-transform: uppercase;
                            text-decoration: none;
                            font-weight: bold;
                            font-size: 12px;
                          `}
                        >
                          {i === 0 ? 'versions' : segment}
                        </Link>
                        {i !== split.length - 1 && <span> / </span>}
                      </React.Fragment>,
                    ];
                  }, [])}
                </div>
              );
            }}
          />
          <Switch>
            <Route
              path="/graphiql/:projectId"
              render={({ match: { params: { projectId } } }) => (
                <Component
                  initialState={{ projectId }}
                  shouldUpdate={({ state }) => state.projectId !== projectId}
                  render={
                    () =>
                      `Ensure that there is only one instance of "graphql" in the node_modules
                    directory. If different versions of "graphql" are the dependencies of other
                    relied on modules, use "resolutions" to ensure only one version is installed.

                    https://yarnpkg.com/en/docs/selective-version-resolutions

                    Duplicate "graphql" modules cannot be used at the same time since different
                    versions may have different capabilities and behavior. The data from one
                    version used in the function from another could produce confusing and
                    spurious results.`
                    // <GraphiQL
                    //   fetcher={body =>
                    //     api({
                    //       endpoint: `/${match.params.projectId}/graphql`,
                    //       body,
                    //     })
                    //   }
                    // />
                  }
                />
              )}
            />
            <Route
              path={'/'}
              exact
              render={() => (
                <ProjectsTable
                  newProjectName={this.state.newProjectName}
                  setActiveProject={s => this.setState(s)}
                  setNewProjectName={s => this.setState(s)}
                  addProject={this.addProject}
                  projectsTotal={this.state.projectsTotal}
                  projects={projects}
                />
              )}
            />
            <Route
              exact
              path={'/:id'}
              render={({
                match: { params: { id: projectId } },
                history,
                location,
              }) => (
                <TypesTable
                  onLinkClick={index => {
                    let state = { activeType: index };
                    this.setState(state);
                    this.getFields({
                      ...state,
                      projectId,
                    });
                  }}
                  projectId={projectId}
                  total={projects?.find(x => x.id === projectId)?.types?.total}
                  data={projects
                    ?.find(x => x.id === projectId)
                    ?.types?.types.map(x => ({
                      ...x,
                      delete: () => (
                        <div
                          css={`
                            cursor: pointer;
                            text-align: center;
                          `}
                          onClick={() =>
                            this.deleteType({ projectId, index: x.index })
                          }
                        >
                          🔥
                        </div>
                      ),
                    }))}
                  customActions={
                    <>
                      <div>
                        <input
                          placeholder="Type name"
                          value={this.state.newTypeName}
                          onChange={e =>
                            this.setState({ newTypeName: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <input
                          placeholder="index"
                          value={this.state.newTypeIndex}
                          onChange={e =>
                            this.setState({ newTypeIndex: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <input
                          placeholder="type"
                          value={this.state.newTypeEsType}
                          onChange={e =>
                            this.setState({ newTypeEsType: e.target.value })
                          }
                        />
                        <button onClick={this.addType}>+</button>
                      </div>
                    </>
                  }
                />
              )}
            />
            <Route
              exact
              path={'/:projectId/:index'}
              render={({
                match: { params: { projectId, index } },
                history,
                location,
                graphqlField = projects
                  .find(x => x.id === projectId)
                  ?.types?.types?.find(x => x.index === index)?.name,
              }) => (
                <State
                  initial={{ tab: 'fields', filterText: '' }}
                  render={({ update, tab, filterText }) => (
                    <div
                      css={`
                        display: flex;
                        flex-direction: column;
                      `}
                    >
                      <div>
                        <a
                          css={`
                            text-transform: uppercase;
                            cursor: pointer;
                            padding: 0 6px;
                            color: ${tab === 'fields'
                              ? 'black'
                              : 'rgb(128, 30, 148)'};
                          `}
                          onClick={() => update({ tab: 'fields' })}
                        >
                          Fields
                        </a>
                        <a
                          css={`
                            text-transform: uppercase;
                            cursor: pointer;
                            padding: 0 6px;
                            color: ${tab === 'matchbox'
                              ? 'black'
                              : 'rgb(128, 30, 148)'};
                          `}
                          onClick={() => update({ tab: 'matchbox' })}
                        >
                          Match Box
                        </a>
                        <a
                          css={`
                            text-transform: uppercase;
                            cursor: pointer;
                            padding: 0 6px;
                            color: ${tab === 'aggs'
                              ? 'black'
                              : 'rgb(128, 30, 148)'};
                          `}
                          onClick={() => update({ tab: 'aggs' })}
                        >
                          Aggregations
                        </a>
                        <a
                          css={`
                            text-transform: uppercase;
                            padding: 0 6px;
                            cursor: pointer;
                            color: ${tab === 'columns'
                              ? 'black'
                              : 'rgb(128, 30, 148)'};
                          `}
                          onClick={() => update({ tab: 'columns' })}
                        >
                          Table
                        </a>
                        <input
                          placeholder="filter fields.."
                          value={filterText}
                          onChange={e => update({ filterText: e.target.value })}
                        />
                      </div>
                      <>
                        {tab === 'fields' && (
                          <div
                            css={`
                              display: flex;
                            `}
                          >
                            <section>
                              <div style={{ padding: 5 }}>
                                <label className="projects">
                                  FIELDS ({this.state.fieldsTotal})
                                </label>
                              </div>
                              {this.state.fields
                                .filter(x => x.field.includes(filterText))
                                .map(x => (
                                  <div
                                    key={x.field}
                                    className={`field-item ${
                                      x.field === activeField?.field
                                        ? 'active'
                                        : ''
                                    }`}
                                    onClick={() => {
                                      this.setState({ activeField: x });
                                    }}
                                  >
                                    {x.field}
                                  </div>
                                ))}
                            </section>
                            <section>
                              <div style={{ padding: 5 }}>
                                <label className="projects">
                                  {activeField?.field}
                                </label>
                              </div>
                              {Object.entries(activeField || {})
                                .filter(([key]) => key !== 'field')
                                .filter(
                                  ([key]) =>
                                    key !== 'displayValues' ||
                                    activeField.type === 'boolean',
                                )
                                .map(([key, val]) => {
                                  const updateActiveField = async value => {
                                    let r = await api({
                                      endpoint: `/projects/${projectId}/types/${index}/fields/${
                                        activeField.field
                                      }/update`,
                                      body: { eshost, key, value },
                                    });
                                    this.setState({
                                      fields: r.fields,
                                      activeField: r.fields.find(
                                        x => x.field === activeField.field,
                                      ),
                                    });
                                  };
                                  const updateBooleanDisplayValue = k => e =>
                                    updateActiveField({
                                      ...val,
                                      [k]: e.target.value,
                                    });
                                  return (
                                    <div key={key} className="type-container">
                                      {startCase(key)}:
                                      {key === 'displayValues' ? (
                                        activeField.type === 'boolean' ? (
                                          <div>
                                            <label>Any: </label>
                                            <input
                                              type="text"
                                              onChange={updateBooleanDisplayValue(
                                                'any',
                                              )}
                                              value={val.any}
                                            />
                                            <label>True: </label>
                                            <input
                                              type="text"
                                              onChange={updateBooleanDisplayValue(
                                                'true',
                                              )}
                                              value={val.true}
                                            />
                                            <label>False: </label>
                                            <input
                                              type="text"
                                              onChange={updateBooleanDisplayValue(
                                                'false',
                                              )}
                                              value={val.false}
                                            />
                                          </div>
                                        ) : null
                                      ) : key === 'unit' ? (
                                        <State
                                          initial={{
                                            val,
                                            measure: val
                                              ? convert().describe(val).measure
                                              : '',
                                          }}
                                          val={val}
                                          onReceiveProps={({
                                            props,
                                            state,
                                            update,
                                          }) => {
                                            if (props.val !== state.val) {
                                              update({
                                                val,
                                                measure: val
                                                  ? convert().describe(val)
                                                      .measure
                                                  : '',
                                              });
                                            }
                                          }}
                                          render={({ measure, update }) => (
                                            <div>
                                              <select
                                                value={measure}
                                                onChange={e =>
                                                  update({
                                                    measure: e.target.value,
                                                  })
                                                }
                                              >
                                                {[
                                                  '',
                                                  ...convert().measures(),
                                                ].map(x => (
                                                  <option key={x}>{x}</option>
                                                ))}
                                              </select>
                                              {measure && (
                                                <select
                                                  value={val || ''}
                                                  onChange={e => {
                                                    update({ val });
                                                    updateActiveField(
                                                      e.target.value,
                                                    );
                                                  }}
                                                >
                                                  {[
                                                    '',
                                                    ...convert().possibilities(
                                                      measure,
                                                    ),
                                                  ].map(x => (
                                                    <option key={x}>{x}</option>
                                                  ))}
                                                </select>
                                              )}
                                            </div>
                                          )}
                                        />
                                      ) : typeof val === 'string' ? (
                                        <input
                                          type="text"
                                          value={val}
                                          onChange={e =>
                                            updateActiveField(e.target.value)
                                          }
                                        />
                                      ) : (
                                        typeof val === 'boolean' && (
                                          <input
                                            type="checkbox"
                                            checked={val}
                                            onChange={e =>
                                              updateActiveField(
                                                e.target.checked,
                                              )
                                            }
                                          />
                                        )
                                      )}
                                    </div>
                                  );
                                })}
                            </section>
                          </div>
                        )}
                        {tab === 'matchbox' && (
                          <MatchBoxTab {...{ projectId, graphqlField }} />
                        )}
                        {tab === 'aggs' && (
                          <AggregationsTab {...{ projectId, graphqlField }} />
                        )}
                        {tab === 'columns' && (
                          <TableTab {...{ projectId, graphqlField }} />
                        )}
                      </>
                    </div>
                  )}
                />
              )}
            />
          </Switch>
        </div>
      </BrowserRouter>
    );
  }
}

export default Dashboard;
