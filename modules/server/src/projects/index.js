import elasticsearch from 'elasticsearch';

import getFields from './getFields';
import addType from './addType';
import spinUp from './spinUp';
import teardown from './teardown';
import getTypes from './getTypes';
import deleteProject from './deleteProject';
import deleteType from './deleteType';
import addProject from './addProject';
import getProjects from './getProjects';
import updateField from './updateField';

export default ({ app, io }) => {
  // create es client
  app.use('/projects', async (req, res, next) => {
    let { eshost } = req.body;
    let host = eshost || req.get('ES_HOST');
    req.context = req.context || {};
    if (!host) return res.json({ error: 'host must be provided' });
    try {
      req.context.es = new elasticsearch.Client({ host });
    } catch (error) {
      return res.json({ error: error.message });
    }
    next();
  });

  app.use(
    '/projects/:id/types/:index/fields/:field/update',
    updateField({ io }),
  );
  app.use('/projects/:id/types/:index/delete', deleteType);
  app.use('/projects/:id/types/:index/fields', getFields);
  app.use('/projects/:id/types/add', addType);
  app.use('/projects/:id/spinUp', spinUp({ io }));
  app.use('/projects/:id/teardown', teardown);
  app.use('/projects/:id/types', getTypes);
  app.use('/projects/:id/delete', deleteProject);
  app.use('/projects/add', addProject);
  app.use('/projects', getProjects);
};
