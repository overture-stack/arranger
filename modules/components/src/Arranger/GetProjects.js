import React from 'react';
import defaultApi from '../utils/api';

class GetProjects extends React.Component {
  state = { projects: [] };

  async componentDidMount() {
    const { api = defaultApi } = this.props;
    let { data } = await api({
      endpoint: '/admin/graphql',
      body: {
        query: `
          {
            projects {
              id
              indices {
                graphqlField
                esIndex
                projectId
              }
            }
          }
        `,
      },
    });
    const projects = {
      projects: data.projects.map(project => ({
        id: project.id,
        types: {
          types: project.indices.map(i => ({
            index: i.esIndex,
            name: i.graphqlField,
          })),
        },
      })),
    };
    this.setState(projects);
  }
  render() {
    return this.state.projects.length > 0 && this.props.render(this.state);
  }
}

export default GetProjects;
