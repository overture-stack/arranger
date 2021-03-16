import { graphql } from 'graphql';

const projects = {};

export function getProject(id) {
  return projects[id];
}

export function getProjects() {
  return Object.values(projects);
}

export function setProject(project) {
  project.runQuery = ({ query, variables, mock }) => {
    const schema = mock ? project.mockSchema : project.schema;
    return graphql({
      schema,
      contextValue: {
        schema,
        es: project.es,
        projectId: project.id,
      },
      source: query,
      variableValues: variables,
    });
  };

  projects[project.id] = project;
}
