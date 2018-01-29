import React from 'react';
import { debounce, startCase } from 'lodash';
import io from 'socket.io-client';
import { BrowserRouter, Route, Link, Redirect } from 'react-router-dom';

import AggsState from '../Aggs/AggsState';
import EditAggs from '../Aggs/EditAggs';
import Header from './Header';
import ProjectsTable from './ProjectsTable';
import './Dashboard.css';

let API = 'http://localhost:5050';

let socket = io(API);

let api = ({ endpoint = '', body }) =>
  fetch(API + endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }).then(r => r.json());

class Dashboard extends React.Component {
  state = {
    eshost: 'http://localhost:9200',
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

      this.setState({
        projects: projectsWithTypes,
        projectsTotal: total,
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
          endpointStatus: () => (
            <div
              css={`
                cursor: pointer;
                text-align: center;
              `}
            >
              {this.state.projectStates.find(p => p.id === x.id)?.status ===
                400 && `⬇️`}
              {this.state.projectStates.find(p => p.id === x.id)?.status ===
                200 && `⬆️`}
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
            eshost={this.state.eshost}
            height={headerHeight}
            handleOnChange={e => {
              let state = { eshost: e.target.value };
              this.setState(state);
              this.getProjects(state);
            }}
          />
          {this.state.error && (
            <div className="error">⚠️ {this.state.error}</div>
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
                  `}
                >
                  {split.reduce(
                    (breadCrumbs, segment, i) => [
                      ...breadCrumbs,
                      <React.Fragment key={segment}>
                        <Link
                          key={segment}
                          to={`/${segment}`} // TODO: parent path
                          css={`
                            text-transform: uppercase;
                            text-decoration: none;
                            font-weight: bold;
                            font-size: 12px;
                          `}
                        >
                          {segment}
                        </Link>
                        {i !== 0 && i !== split.length - 1 && <span> / </span>}
                      </React.Fragment>,
                    ],
                    [],
                  )}
                </div>
              );
            }}
          />
          <Route
            path="/projects"
            exact
            render={() => (
              <div
                css={`
                  flex-grow: 1;
                  position: relative;
                `}
              >
                <ProjectsTable
                  newProjectName={this.state.newProjectName}
                  setNewProjectName={s => this.setState(s)}
                  addProject={this.addProject}
                  projectsTotal={this.state.projectsTotal}
                  projects={this.state.projects}
                />
              </div>
            )}
          />
          <Route
            exact
            path="/projects/:id"
            render={({ match, history, location }) => (
              <section>
                <div style={{ padding: 5 }}>
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
                </div>
                <div>
                  <label className="projects">
                    TYPES ({this.state.typesTotal})
                  </label>
                  {this.state.projects
                    ?.find(x => x.id === match.params.id)
                    ?.types?.types?.map(x => (
                      <div key={x.index} className="type-container">
                        <div>
                          <label>NAME: </label>
                          <span>{x.name}</span>
                        </div>
                        <div>
                          <label>INDEX: </label>
                          <span
                            key={x.index}
                            onClick={() => {
                              let state = { activeType: x.index };
                              this.setState(state);
                              this.getFields({
                                ...state,
                                projectId: match.params.id,
                              });
                              history.push(location.pathname + '/' + x.index);
                            }}
                            style={{
                              textDecoration:
                                this.state.activeType === x.index
                                  ? 'none'
                                  : 'underline',
                              cursor:
                                this.state.activeType === x.index
                                  ? 'default'
                                  : 'pointer',
                            }}
                          >
                            {x.index}
                          </span>
                        </div>
                        <div>
                          <label>ACTIVE: </label>
                          <input
                            type="checkbox"
                            checked={x.active}
                            key={x.index}
                            onChange={() => {}}
                          />
                        </div>
                        {!x.mappings && (
                          <div className="warning">No mappings found.</div>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            )}
          />
          <Route
            exact
            path="/projects/:projectId/:index"
            render={({ match, history, location }) => (
              <div>
                <section>
                  <div style={{ padding: 5 }}>
                    <label className="projects">
                      FIELDS ({this.state.fieldsTotal})
                    </label>
                  </div>
                  {this.state.fields.map(x => (
                    <div
                      key={x.field}
                      className={`field-item ${
                        x.field == this.state.activeField?.field ? 'active' : ''
                      }`}
                      onClick={() => {
                        this.setState({ activeField: x });
                        history.push(location.pathname + '/' + x.field);
                      }}
                    >
                      {x.field}
                    </div>
                  ))}
                </section>
                <AggsState
                  projectId={match.params.projectId}
                  index={match.params.index}
                  render={aggsState => (
                    <div>
                      <EditAggs
                        handleChange={aggsState.update}
                        {...aggsState}
                      />
                    </div>
                  )}
                />
              </div>
            )}
          />
          <Route
            exact
            path="/projects/:projectId/:index/:field"
            render={({ match, history, location }) => (
              <div className="row">
                <section>
                  <div style={{ padding: 5 }}>
                    <label className="projects">
                      FIELDS ({this.state.fieldsTotal})
                    </label>
                  </div>
                  {this.state.fields.map(x => (
                    <div
                      key={x.field}
                      className={`field-item ${
                        x.field == this.state.activeField?.field ? 'active' : ''
                      }`}
                      onClick={() => {
                        this.setState({ activeField: x });
                        history.push(
                          `/projects/${match.params.projectId}/${
                            match.params.index
                          }/${x.field}`,
                        );
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
                        {typeof val === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={val}
                            onChange={async e => {
                              let r = await api({
                                endpoint: `/projects/${
                                  match.params.projectId
                                }/types/${match.params.index}/fields/${
                                  match.params.field
                                }/update`,
                                body: {
                                  eshost: this.state.eshost,
                                  key,
                                  value: e.target.checked,
                                },
                              });

                              let activeField = r.fields.find(
                                x => x.field === this.state.activeField.field,
                              );

                              this.setState({ fields: r.fields, activeField });
                            }}
                          />
                        ) : (
                          val
                        )}
                      </div>
                    ))}
                </section>
              </div>
            )}
          />
        </div>
      </BrowserRouter>
    );
  }
}

export default Dashboard;
