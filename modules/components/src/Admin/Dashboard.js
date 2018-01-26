import React from 'react';
import { debounce } from 'lodash';
import io from 'socket.io-client';
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
      this.setState({
        projects,
        projectsTotal: total,
        error: null,
        fields: [],
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

  addProject = async () => {
    let { projects, total, error } = await api({
      endpoint: '/projects/add',
      body: { eshost: this.state.eshost, id: this.state.newProjectName },
    });

    if (error) {
      this.setState({ error });
    }

    if (!error) {
      this.setState({
        projects,
        projectsTotal: total,
        activeProject: this.state.newProjectName,
        newProjectName: '',
        error: null,
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
      this.setState({
        projects,
        projectsTotal: total,
        types: [],
        activeProject: null,
        error: null,
      });
    }
  };

  getFields = async ({ activeType }) => {
    let { fields, total, error } = await api({
      endpoint: `/projects/${
        this.state.activeProject
      }/types/${activeType}/fields`,
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
      this.setState({
        types,
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
    return (
      <div className="app">
        <div className="row">
          <div className="title-arranger">ARRANGER</div>
          <div className="title-elasticsearch">ELASTICSEARCH HOST :</div>
          <input
            className="eshost-input"
            value={this.state.eshost}
            onChange={e => {
              let state = { eshost: e.target.value };
              this.setState(state);
              this.getProjects(state);
            }}
          />
        </div>
        {this.state.error && <div className="error">⚠️ {this.state.error}</div>}
        <div className="row">
          <section>
            <div>
              <input
                style={{ padding: 5 }}
                placeholder="New Project..."
                value={this.state.newProjectName}
                onChange={e =>
                  this.setState({ newProjectName: e.target.value })
                }
              />
              <button onClick={this.addProject}>+</button>
            </div>
            <div>
              <label className="projects">
                PROJECTS ({this.state.projectsTotal})
              </label>
              {this.state.projects.map(x => (
                <div
                  key={x.id}
                  className="row"
                  style={{ alignItems: 'center' }}
                >
                  <span
                    onClick={() =>
                      this.setState({ activeProject: x.id }, this.getTypes)
                    }
                    style={{
                      textDecoration:
                        this.state.activeProject === x.id
                          ? 'none'
                          : 'underline',
                      cursor:
                        this.state.activeProject === x.id
                          ? 'default'
                          : 'pointer',
                      color:
                        this.state.activeProject === x.id ? 'blue' : 'black',
                    }}
                  >
                    {x.id}
                  </span>
                  <div style={{ marginLeft: 'auto' }}>
                    {this.state.activeProject === x.id && (
                      <>
                        {x.active &&
                          this.state.projectStates.find(p => p.id === x.id)
                            ?.status !== 200 && (
                            <span
                              className="onoff"
                              style={{ cursor: 'pointer' }}
                              onClick={() => this.spinup({ id: x.id })}
                            >
                              ⚡️
                            </span>
                          )}
                        {this.state.projectStates.find(p => p.id === x.id)
                          ?.status === 200 && (
                          <span
                            className="onoff"
                            style={{ cursor: 'pointer' }}
                            onClick={() => this.spinup({ id: x.id })}
                          >
                            💤
                          </span>
                        )}
                        <span
                          style={{ cursor: 'pointer' }}
                          onClick={() => this.deleteProject({ id: x.id })}
                        >
                          🔥
                        </span>
                      </>
                    )}
                    {x.active && (
                      <>
                        <span>✅</span>
                        <span>
                          {this.state.projectStates.find(p => p.id === x.id)
                            ?.status === 400 && `⬇️`}
                          {this.state.projectStates.find(p => p.id === x.id)
                            ?.status === 200 && `⬆️`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
          {this.state.activeProject && (
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
                {this.state.types.map(x => (
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
                          this.getFields(state);
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
          {this.state.activeProject &&
            this.state.activeType && (
              <section>
                <div style={{ padding: 5 }}>
                  <label className="projects">
                    FIELDS ({this.state.fieldsTotal})
                  </label>
                </div>
                {this.state.fields.map(x => (
                  <div
                    key={x.field}
                    className="type-container"
                    onClick={() => this.setState({ activeField: x })}
                  >
                    {x.field}
                  </div>
                ))}
              </section>
            )}
          {this.state.activeProject &&
            this.state.activeType &&
            this.state.activeField && (
              <section>
                <div style={{ padding: 5 }}>
                  <label className="projects">CONFIGURE FIELD</label>
                </div>
                {Object.entries(this.state.activeField).map(([key, val]) => (
                  <div key={key} className="type-container">
                    {key}: {val}
                  </div>
                ))}
              </section>
            )}
        </div>
      </div>
    );
  }
}

export default Dashboard;
