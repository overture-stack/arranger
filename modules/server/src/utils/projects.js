import { runQuery } from 'apollo-server-core';

const projects = {};

export function getProject(id) {
  return projects[id];
}

export function getProjects() {
  return Object.values(projects);
}

export function setProject(id, project) {
  project.runQuery = ({ query, variables }) =>
    runQuery({
      schema: project.schema,
      query,
      context: {
        schema: project.schema,
        es: project.es,
        projectId: id,
        io: project.io,
      },
      variables,
    });

  projects[id] = project;
}
