import apollo, { runQuery } from 'apollo-server-core';

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
    return runQuery({
      schema,
      query,
      context: {
        schema,
        es: project.es,
        projectId: project.id,
      },
      variables,
    });
  };

  projects[project.id] = project;
}
