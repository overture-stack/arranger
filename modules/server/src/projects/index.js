import elasticsearch from 'elasticsearch';
import express from 'express';
import { ES_LOG } from '../utils/config';
import getFields from './getFields';
import addType from './addType';
import spinUp from './spinUp';
import teardown from './teardown';
import getTypes from './getTypes';
import updateProject from './updateProject';
import deleteProject from './deleteProject';
import deleteType from './deleteType';
import addProject from './addProject';
import getProjects from './getProjects';
import updateField from './updateField';

export default ({ io, graphqlOptions }) => {
  const router = express.Router();
  // create es client
  router.use('/', async (req, res, next) => {
    let { eshost } = req.body;
    let host = eshost || req.get('ES_HOST');
    req.context = req.context || {};
    if (!host) return res.json({ error: 'host must be provided' });
    try {
      req.context.es = new elasticsearch.Client({
        host,
        log: ES_LOG,
      });
    } catch (error) {
      return res.json({ error: error.message });
    }
    next();
  });

  router.use('/:id/types/:index/fields/:field/update', updateField({ io }));
  router.use('/:id/types/:index/delete', deleteType);
  router.use('/:id/types/:index/fields', getFields);
  router.use('/:id/types/add', addType);
  router.use('/:id/spinUp', spinUp({ io, graphqlOptions }));
  router.use('/:id/teardown', teardown);
  router.use('/:id/types', getTypes);
  router.use('/:id/delete', deleteProject);
  router.use('/:id/update', updateProject);
  router.use('/add', addProject);
  router.use('/', getProjects);

  return router;
};
