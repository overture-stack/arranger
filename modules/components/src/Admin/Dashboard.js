import React from 'react';
import { debounce } from 'lodash';

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
    eshost: '',
    projects: [],
    newProjectName: '',
    activeProject: '',
  };

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
        <label>new project: </label>
        <input
          value={this.state.newProjectName}
          onChange={e => this.setState({ newProjectName: e.target.value })}
        />
        <button onClick={this.addProject}>Add Project</button>
        <div>
          projects:
          {this.state.projects.map(x => <div key={x.id}>{x.id}</div>)}
        </div>
      </div>
    );
  }
}

export default Dashboard;
