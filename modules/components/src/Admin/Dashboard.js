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
    newProjectName: 'test',
    activeProject: null,

    newTypeIndex: '',
    newTypeName: '',
    types: [],
    activeType: null,
  };

  componentDidMount() {
    this.getProjects({ eshost: this.state.eshost });
  }

  getProjects = debounce(async ({ eshost }) => {
    let { projects, error } = await api({
      endpoint: '/projects',
      body: { eshost },
    });

    if (!error) {
      this.setState({ projects });
    }
  }, 300);

  addProject = async () => {
    let { projects, error } = await api({
      endpoint: '/projects/add',
      body: { eshost: this.state.eshost, id: this.state.newProjectName },
    });

    if (!error) {
      this.setState({ projects });
    }
  };

  getTypes = async () => {
    let { types, error } = await api({
      endpoint: '/projects/add',
      body: { eshost: this.state.eshost, id: this.state.newProjectName },
    });

    if (!error) {
      this.setState({ projects });
    }
  };

  render() {
    return (
      <div>
        <div>
          <h1>Arranger</h1>
        </div>
        <div>
          <label>eshost: </label>
          <input
            type="text"
            value={this.state.eshost}
            onChange={e => {
              let state = { eshost: e.target.value };
              this.setState(state);
              this.getProjects(state);
            }}
          />
        </div>
        <div>
          <label>new project: </label>
          <input
            value={this.state.newProjectName}
            onChange={e => this.setState({ newProjectName: e.target.value })}
          />
          <button onClick={this.addProject}>Add Project</button>
        </div>
        <div>
          <label>projects: </label>
          {this.state.projects.map(x => (
            <div
              key={x.id}
              onClick={() =>
                this.setState({ activeProject: x.id }, this.getTypes)
              }
              style={{
                textDecoration:
                  this.state.activeProject === x.id ? 'none' : 'underline',
                cursor:
                  this.state.activeProject === x.id ? 'default' : 'pointer',
                color: this.state.activeProject === x.id ? 'blue' : 'default',
              }}
            >
              {x.id}
            </div>
          ))}
        </div>
        {this.state.activeProject && (
          <>
            <div>
              <label>new type index: </label>
              <input
                value={this.state.newTypeIndex}
                onChange={e => this.setState({ newTypeIndex: e.target.value })}
              />
              <label>new type name (ie. "Case"): </label>
              <input
                value={this.state.newTypeName}
                onChange={e => this.setState({ newTypeName: e.target.value })}
              />
              <button onClick={this.addType}>Add Type</button>
            </div>
            <div>
              <label>types: </label>
              {this.state.types.map(x => (
                <div
                  key={x.id}
                  onClick={() => this.setState({ activeType: x.id })}
                  style={{
                    textDecoration:
                      this.state.activeType === x.id ? 'none' : 'underline',
                    cursor:
                      this.state.activeType === x.id ? 'default' : 'pointer',
                  }}
                >
                  {x.id}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
}

export default Dashboard;
