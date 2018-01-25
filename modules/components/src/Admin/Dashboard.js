import React from 'react';
import { debounce } from 'lodash';
import './Dashboard.css';

let API = 'http://localhost:5050';

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

    projects: [],
    projectsTotal: 0,
    newProjectName: '',
    activeProject: null,

    newTypeIndex: '',
    newTypeName: '',
    types: [],
    typesTotal: 0,
    activeType: null,
  };

  componentDidMount() {
    this.getProjects({ eshost: this.state.eshost });
  }

  getProjects = debounce(async ({ eshost }) => {
    let { projects, total, error } = await api({
      endpoint: '/projects',
      body: { eshost },
    });

    if (error) {
      this.setState({ projects: [], types: [], activeProject: null });
    }

    if (!error) {
      this.setState({ projects, projectsTotal: total });
    }
  }, 300);

  addProject = async () => {
    let { projects, total, error } = await api({
      endpoint: '/projects/add',
      body: { eshost: this.state.eshost, id: this.state.newProjectName },
    });

    if (!error) {
      this.setState({
        projects,
        projectsTotal: total,
        activeProject: this.state.newProjectName,
        newProjectName: '',
      });
    }
  };

  deleteProject = async ({ id }) => {
    let { projects, total, error } = await api({
      endpoint: `/projects/${id}/delete`,
      body: { eshost: this.state.eshost },
    });

    if (!error) {
      this.setState({
        projects,
        projectsTotal: total,
        types: [],
        activeProject: null,
      });
    }
  };

  getTypes = async () => {
    let { types, total, error } = await api({
      endpoint: `/projects/${this.state.activeProject}/types`,
      body: { eshost: this.state.eshost },
    });

    if (!error) {
      this.setState({ types, typesTotal: total });
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

    if (!error) {
      this.setState({
        types,
        typesTotal: total,
        newTypeIndex: '',
        newTypeName: '',
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
                  {this.state.activeProject === x.id && (
                    <div style={{ marginLeft: 'auto' }}>
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => this.spinup({ id: x.id })}
                      >
                        🌀
                      </span>
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => this.deleteProject({ id: x.id })}
                      >
                        🔥
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          {this.state.activeProject && (
            <section>
              <div style={{ padding: 5 }}>
                <input
                  placeholder="Type name"
                  value={this.state.newTypeName}
                  onChange={e => this.setState({ newTypeName: e.target.value })}
                />
                <input
                  placeholder="index"
                  value={this.state.newTypeIndex}
                  onChange={e =>
                    this.setState({ newTypeIndex: e.target.value })
                  }
                />
                <button onClick={this.addType}>Add Type</button>
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
                        onClick={() => this.setState({ activeType: x.index })}
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
                  <label>FIELDS (): </label>
                </div>
              </section>
            )}
        </div>
      </div>
    );
  }
}

export default Dashboard;
