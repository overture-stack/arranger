import React from 'react';
import { debounce, startCase } from 'lodash';
import io from 'socket.io-client';
import { BrowserRouter, Route, Link, Redirect } from 'react-router-dom';
import convert from 'convert-units';
import CaretDownIcon from 'react-icons/lib/fa/caret-down';
import CaretUpIcon from 'react-icons/lib/fa/caret-up';

import State from '../State';
import AggsState from '../Aggs/AggsState';
import EditAggs from '../Aggs/EditAggs';
import Header from './Header';
import ProjectsTable from './ProjectsTable';
import TypesTable from './TypesTable';
import './Dashboard.css';
import { ColumnsState, EditColumns } from '../DataTable';
import { ES_HOST, API } from '../utils/config';

let socket = io(API);

export let api = ({ endpoint = '', body, headers }) =>
  fetch(API + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  }).then(r => r.json());

class Dashboard extends React.Component {
  state = {
    eshost: ES_HOST,
    error: null,

    projects: [],
    projectsTotal: 0,
    newProjectName: '',
    activeProject: null,
    projectStates: [],

    newTypeIndex: '',
    newTypeName: '',
    types: [],
    typesTotal: 0,
    activeType: null,

    fields: [],
    fieldsTotal: 0,
    activeField: null,
  };

  componentDidMount() {
    this.getProjects({ eshost: this.state.eshost });

    socket.io.on('connect_error', error => {
      this.setState({ error: error.message });
    });

    socket.io.on('reconnect', a => {
      this.setState({ error: null });
    });

    socket.on('server::projectsStatus', projectStates => {
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

      socket.emit('arranger::monitorProjects', {
        projects: projects.filter(x => x.active),
        eshost,
      });
    }
  }, 300);

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
          active: () =>
            x.active && (
              <div
                css={`
                  cursor: pointer;
                  text-align: center;
                `}
              >
                ✅
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
                    color: rgb(21, 164, 66);
                    font-size: 25px;
                  `}
                >
                  <CaretUpIcon />
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
    let { projects, total, error } = await api({
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

  render() {
    let headerHeight = 38;
    return (
      <BrowserRouter>
        <div
          className="app"
          css={`
            display: flex;
            flex-direction: column;
          `}
        >
          <Header
            css={`
              flex: none;
            `}
            eshost={this.state.eshost}
            height={headerHeight}
            handleOnChange={e => {
              localStorage.ES_HOST = e.target.value;
              let state = { eshost: e.target.value };
              this.setState(state);
              this.getProjects(state);
            }}
          />
          {this.state.error && (
            <div
              className="error"
              css={`
                flex: none;
              `}
            >
              ⚠️ {this.state.error}
            </div>
          )}
          <Route
            render={p =>
              // needed for storybook
              p.location.pathname === '/iframe.html' && (
                <Redirect to="/projects" />
              )
            }
          />
          <Route // breadcrums
            render={p => {
              let split = location.pathname.split('/');
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
                          {i === 1 ? 'versions' : segment}
                        </Link>
                        {i !== 0 && i !== split.length - 1 && <span> / </span>}
                      </React.Fragment>,
                    ];
                  }, [])}
                </div>
              );
            }}
          />
          <Route
            path="/projects"
            exact
            render={() => (
              <ProjectsTable
                newProjectName={this.state.newProjectName}
                setActiveProject={s => this.setState(s)}
                setNewProjectName={s => this.setState(s)}
                addProject={this.addProject}
                projectsTotal={this.state.projectsTotal}
                projects={this.state.projects}
              />
            )}
          />
          <Route
            exact
            path="/projects/:id"
            render={({ match, history, location }) => (
              <TypesTable
                onLinkClick={index => {
                  let state = { activeType: index };
                  this.setState(state);
                  this.getFields({
                    ...state,
                    projectId: match.params.id,
                  });
                }}
                projectId={match.params.id}
                total={
                  this.state.projects?.find(x => x.id === match.params.id)
                    ?.types?.total
                }
                data={this.state.projects
                  ?.find(x => x.id === match.params.id)
                  ?.types?.types.map(x => ({
                    ...x,
                    delete: () => (
                      <div
                        css={`
                          cursor: pointer;
                          text-align: center;
                        `}
                        onClick={() =>
                          this.deleteType({
                            projectId: match.params.id,
                            index: x.index,
                          })
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
                      <button onClick={this.addType}>+</button>
                    </div>
                  </>
                }
              />
            )}
          />
          <Route
            exact
            path="/projects/:projectId/:index"
            render={({ match, history, location }) => (
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
                                    x.field == this.state.activeField?.field
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
                                {this.state.activeField?.field}
                              </label>
                            </div>
                            {Object.entries(this.state.activeField || {})
                              .filter(([key]) => key !== 'field')
                              .map(([key, val]) => (
                                <div key={key} className="type-container">
                                  {startCase(key)}:
                                  {key === 'unit' ? (
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
                                              ? convert().describe(val).measure
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
                                            {['', ...convert().measures()].map(
                                              x => <option key={x}>{x}</option>,
                                            )}
                                          </select>
                                          {measure && (
                                            <select
                                              value={val || ''}
                                              onChange={async e => {
                                                update({ val });
                                                let r = await api({
                                                  endpoint: `/projects/${
                                                    match.params.projectId
                                                  }/types/${
                                                    match.params.index
                                                  }/fields/${
                                                    this.state.activeField
                                                      ?.field
                                                  }/update`,
                                                  body: {
                                                    eshost: this.state.eshost,
                                                    key,
                                                    value: e.target.value,
                                                  },
                                                });
                                                let activeField = r.fields.find(
                                                  x =>
                                                    x.field ===
                                                    this.state.activeField
                                                      .field,
                                                );

                                                this.setState({
                                                  fields: r.fields,
                                                  activeField,
                                                });
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
                                      onChange={async e => {
                                        let r = await api({
                                          endpoint: `/projects/${
                                            match.params.projectId
                                          }/types/${
                                            match.params.index
                                          }/fields/${
                                            this.state.activeField?.field
                                          }/update`,
                                          body: {
                                            eshost: this.state.eshost,
                                            key,
                                            value: e.target.value,
                                          },
                                        });

                                        let activeField = r.fields.find(
                                          x =>
                                            x.field ===
                                            this.state.activeField.field,
                                        );

                                        this.setState({
                                          fields: r.fields,
                                          activeField,
                                        });
                                      }}
                                    />
                                  ) : (
                                    typeof val === 'boolean' && (
                                      <input
                                        type="checkbox"
                                        checked={val}
                                        onChange={async e => {
                                          let r = await api({
                                            endpoint: `/projects/${
                                              match.params.projectId
                                            }/types/${
                                              match.params.index
                                            }/fields/${
                                              this.state.activeField?.field
                                            }/update`,
                                            body: {
                                              eshost: this.state.eshost,
                                              key,
                                              value: e.target.checked,
                                            },
                                          });

                                          let activeField = r.fields.find(
                                            x =>
                                              x.field ===
                                              this.state.activeField.field,
                                          );

                                          this.setState({
                                            fields: r.fields,
                                            activeField,
                                          });
                                        }}
                                      />
                                    )
                                  )}
                                </div>
                              ))}
                          </section>
                        </div>
                      )}
                      {tab === 'aggs' && (
                        <AggsState
                          projectId={match.params.projectId}
                          index={match.params.index}
                          render={aggsState => (
                            <EditAggs
                              handleChange={aggsState.update}
                              {...aggsState}
                            />
                          )}
                        />
                      )}
                      {tab === 'columns' && (
                        <div>
                          <div>
                            <label>Columns State</label>
                          </div>
                          <ColumnsState
                            projectId={match.params.projectId}
                            index={match.params.index}
                            render={columnsState => (
                              <EditColumns
                                handleChange={columnsState.update}
                                {...columnsState}
                              />
                            )}
                          />
                        </div>
                      )}
                    </>
                  </div>
                )}
              />
            )}
          />
        </div>
      </BrowserRouter>
    );
  }
}

export default Dashboard;
