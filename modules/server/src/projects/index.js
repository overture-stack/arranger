import getFields from './getFields';
import addType from './addType';
import spinup from './spinup';
import getTypes from './getTypes';
import deleteProject from './deleteProject';
import addProject from './addProject';
import getProjects from './getProjects';

export default ({ app }) => {
  app.use('/projects/:id/types/:index/fields', getFields);
  app.use('/projects/:id/types/add', addType);
  app.use('/projects/:id/spinup', spinup({ app }));
  app.use('/projects/:id/types', getTypes);
  app.use('/projects/:id/delete', deleteProject);
  app.use('/projects/add', addProject);
  app.use('/projects', getProjects);
};
