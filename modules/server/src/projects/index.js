import getFields from './getFields';
import addType from './addType';
import spinup from './spinup';
import teardown from './teardown';
import getTypes from './getTypes';
import deleteProject from './deleteProject';
import deleteType from './deleteType';
import addProject from './addProject';
import getProjects from './getProjects';
import updateField from './updateField';

export default ({ app, io }) => {
  app.use(
    '/projects/:id/types/:index/fields/:field/update',
    updateField({ io }),
  );
  app.use('/projects/:id/types/:index/delete', deleteType);
  app.use('/projects/:id/types/:index/fields', getFields);
  app.use('/projects/:id/types/add', addType);
  app.use('/projects/:id/spinup', spinup({ app, io }));
  app.use('/projects/:id/teardown', teardown({ app }));
  app.use('/projects/:id/types', getTypes);
  app.use('/projects/:id/delete', deleteProject);
  app.use('/projects/add', addProject);
  app.use('/projects', getProjects);
};
