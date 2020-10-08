import elasticsearch from '@elastic/elasticsearch';
import express from 'express';

import getFields from './getFields';
import addType from './addType';
import spinUp from './spinUp';
import teardown from './teardown';
import exportProject from './export';
import getTypes from './getTypes';
import updateProject from './updateProject';
import deleteProject from './deleteProject';
import deleteType from './deleteType';
import addProject from './addProject';
import getProjects from './getProjects';
import updateField from './updateField';
import buildEsClientViaEnv from '../server';

export default ({ graphqlOptions, enableAdmin }) => {
  const router = express.Router();
  // create es client
  router.use('/', async (req, res, next) => {
    try {
      req.context.es = buildEsClientViaEnv();
    } catch (error) {
      return res.json({ error: error.message });
    }
    next();
  });

  if (enableAdmin) {
    console.warn('Admin endpoints are enabled!!');
    router.use('/:id/types/:index/fields/:field/update', updateField({}));
    router.use('/:id/types/:index/delete', deleteType);
    router.use('/:id/types/add', addType);
    router.use('/:id/spinUp', spinUp({ graphqlOptions, enableAdmin }));
    router.use('/:id/teardown', teardown);
    router.use('/:id/delete', deleteProject);
    router.use('/:id/update', updateProject);
    router.use('/add', addProject);
  }
  // add these endpoints after Admin endpoints are added as Admin endpoints are more specific endpoints
  // and when serving requests; express serves from the first endpoint that matches the request url
  // so we should add more specific endpoints first
  router.use('/:id/export', exportProject);
  router.use('/:id/types/:index/fields', getFields);
  router.use('/:id/types', getTypes);
  router.use('/', getProjects);

  return router;
};
