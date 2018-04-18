import React from 'react';

import defaultApi from '../utils/api';
import { ES_HOST } from '../utils/config';

// QUESTION: Is this ever actually used?

class GetProjects extends React.Component {
  state = { projects: [] };

  async componentDidMount() {
    const { api = defaultApi } = this.props;
    let { projects } = await api({
      endpoint: '/projects',
      body: { eshost: ES_HOST },
    });

    projects = await this.addTypesToProjects(projects);

    this.setState({ projects });
  }

  addTypesToProjects = projects => {
    const { api = defaultApi } = this.props;
    return Promise.all(
      projects.map((x, i) =>
        api({
          endpoint: `/projects/${x.id}/types`,
          body: { eshost: ES_HOST },
        }).then(data => ({
          ...projects[i],
          types: data,
        })),
      ),
    );
  };
  render() {
    return this.state.projects.length > 0 && this.props.render(this.state);
  }
}

export default GetProjects;
